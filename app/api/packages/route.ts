import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

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
        { error: 'Package edits are locked once the draft starts.' },
        { status: 409 },
      ),
    };
  }
  return { sb, draftId: draft.id };
}

// Set the package membership for a list of player IDs.
// - If `label` is non-empty, ensures a package with that label exists and
//   assigns all listed players to it.
// - If `label` is empty/null, unassigns the listed players (sets package_id null).
// Empty packages (no remaining members) are deleted to keep the table clean.
export async function POST(req: Request) {
  const auth = await requireSetupCommissioner();
  if ('error' in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as
    | { playerIds: string[]; label?: string | null }
    | null;
  if (!body?.playerIds || !Array.isArray(body.playerIds) || body.playerIds.length === 0) {
    return NextResponse.json({ error: 'playerIds required' }, { status: 400 });
  }

  const label = body.label?.trim() || null;

  // Capture the package_ids the listed players are leaving so we can prune
  // emptied packages afterward.
  const { data: existing } = await auth.sb
    .from('players')
    .select('package_id')
    .in('id', body.playerIds);
  const oldPackageIds = new Set(
    (existing ?? []).map((r) => r.package_id).filter((v): v is string => !!v),
  );

  let newPackageId: string | null = null;
  if (label) {
    // Reuse a package with the same label if one exists, otherwise create.
    const { data: existingPkg } = await auth.sb
      .from('packages')
      .select('id')
      .eq('draft_id', auth.draftId)
      .eq('label', label)
      .maybeSingle();
    if (existingPkg) {
      newPackageId = existingPkg.id;
    } else {
      const { data: created, error: createErr } = await auth.sb
        .from('packages')
        .insert({ draft_id: auth.draftId, label })
        .select('id')
        .single();
      if (createErr || !created) {
        return NextResponse.json({ error: createErr?.message ?? 'Failed to create package' }, { status: 500 });
      }
      newPackageId = created.id;
    }
  }

  const { error: updateErr } = await auth.sb
    .from('players')
    .update({ package_id: newPackageId })
    .in('id', body.playerIds);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Prune any old packages now devoid of members.
  for (const pkgId of oldPackageIds) {
    if (pkgId === newPackageId) continue;
    const { count } = await auth.sb
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('package_id', pkgId);
    if ((count ?? 0) === 0) {
      await auth.sb.from('packages').delete().eq('id', pkgId);
    }
  }

  return NextResponse.json({ ok: true, packageId: newPackageId });
}
