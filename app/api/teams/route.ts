import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

type TeamRow = {
  id?: string;
  name: string;
  captain_name?: string | null;
  passcode: string;
  draft_position: number;
};

async function requireSetupCommissioner() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, status')
    .eq('id', session.draftId)
    .single();
  if (!draft) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  if (draft.status !== 'setup') {
    return {
      error: NextResponse.json(
        { error: 'Team edits are locked once the draft starts.' },
        { status: 409 },
      ),
    };
  }
  return { sb, draftId: draft.id };
}

// Bulk replace the team list. Used by the Draft Settings page so the
// commissioner can reorder, rename, add, and remove teams in one save.
export async function PUT(req: Request) {
  const auth = await requireSetupCommissioner();
  if ('error' in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as { teams: TeamRow[] } | null;
  if (!body?.teams || !Array.isArray(body.teams) || body.teams.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 teams.' }, { status: 400 });
  }

  // Validate
  const names = new Set<string>();
  const passcodes = new Set<string>();
  for (const t of body.teams) {
    if (!t.name?.trim() || !t.passcode?.trim()) {
      return NextResponse.json({ error: 'Every team needs a name and passcode.' }, { status: 400 });
    }
    if (passcodes.has(t.passcode.trim())) {
      return NextResponse.json({ error: 'Team passcodes must be unique.' }, { status: 400 });
    }
    names.add(t.name.trim());
    passcodes.add(t.passcode.trim());
  }

  // Strategy: delete teams not in the list, upsert/update the rest.
  // (Cascades remove their queue/picks — picks shouldn't exist in setup state.)
  const incomingIds = body.teams.map((t) => t.id).filter(Boolean) as string[];
  if (incomingIds.length > 0) {
    await auth.sb
      .from('teams')
      .delete()
      .eq('draft_id', auth.draftId)
      .not('id', 'in', `(${incomingIds.map((id) => `"${id}"`).join(',')})`);
  } else {
    await auth.sb.from('teams').delete().eq('draft_id', auth.draftId);
  }

  // To avoid (draft_id, draft_position) and (draft_id, passcode) unique conflicts during reorders,
  // first stage every kept team to negative draft_position values and temp passcodes.
  for (const t of body.teams) {
    if (!t.id) continue;
    await auth.sb
      .from('teams')
      .update({
        draft_position: -Math.abs(t.draft_position) - 1000,
        passcode: `__tmp_${t.id}`,
      })
      .eq('id', t.id);
  }

  // Now apply final values, inserting new rows where no id present.
  for (let i = 0; i < body.teams.length; i++) {
    const t = body.teams[i];
    const draftPosition = i + 1;
    if (t.id) {
      const { error } = await auth.sb
        .from('teams')
        .update({
          name: t.name.trim(),
          captain_name: t.captain_name?.trim() || null,
          passcode: t.passcode.trim(),
          draft_position: draftPosition,
        })
        .eq('id', t.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await auth.sb.from('teams').insert({
        draft_id: auth.draftId,
        name: t.name.trim(),
        captain_name: t.captain_name?.trim() || null,
        passcode: t.passcode.trim(),
        draft_position: draftPosition,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
