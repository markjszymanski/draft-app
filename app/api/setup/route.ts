import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession, setSession } from '@/lib/auth';
import { generatePlayerPool } from '@/lib/seed-data';

type SetupBody = {
  name: string;
  year: number;
  salary_cap: number;
  pick_timer_seconds: number;
  draft_mode: 'linear' | 'snake';
  commissioner_passcode: string;
  teams: Array<{ name: string; captain_name?: string; passcode: string }>;
  seed_players?: { goalies?: number; defense?: number; forwards?: number };
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isCommissioner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as SetupBody | null;
  if (!body || !body.name || !Array.isArray(body.teams) || body.teams.length < 2) {
    return NextResponse.json({ error: 'Invalid setup payload' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Generate pool first so we can derive roster size = ceil(players / teams).
  // If no seed players requested, pool is empty and roster_size starts at 0
  // (it'll be recomputed when the commissioner imports/adds players).
  const pool = generatePlayerPool(body.seed_players);
  const rosterSize = pool.length > 0 ? Math.ceil(pool.length / body.teams.length) : 0;

  const { data: draft, error: draftErr } = await sb
    .from('drafts')
    .insert({
      name: body.name,
      year: body.year,
      salary_cap: body.salary_cap,
      pick_timer_seconds: body.pick_timer_seconds,
      draft_mode: body.draft_mode,
      roster_size: rosterSize,
      commissioner_passcode: body.commissioner_passcode,
      status: 'setup',
      current_pick_number: 1,
    })
    .select('id')
    .single();

  if (draftErr || !draft) {
    return NextResponse.json({ error: draftErr?.message || 'Failed to create draft' }, { status: 500 });
  }

  // Insert teams in given order — draft_position = index + 1
  const teamRows = body.teams.map((t, i) => ({
    draft_id: draft.id,
    name: t.name,
    captain_name: t.captain_name ?? null,
    draft_position: i + 1,
    passcode: t.passcode,
  }));
  const { error: teamErr } = await sb.from('teams').insert(teamRows);
  if (teamErr) {
    await sb.from('drafts').delete().eq('id', draft.id);
    return NextResponse.json({ error: teamErr.message }, { status: 500 });
  }

  if (pool.length > 0) {
    const playerRows = pool.map((p) => ({ ...p, draft_id: draft.id }));
    const { error: playerErr } = await sb.from('players').insert(playerRows);
    if (playerErr) {
      return NextResponse.json({ error: playerErr.message }, { status: 500 });
    }
  }

  // Re-set commissioner session bound to this draft
  await setSession({ draftId: draft.id, isCommissioner: true });

  return NextResponse.json({ ok: true, draftId: draft.id });
}
