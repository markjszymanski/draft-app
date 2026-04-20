import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = createServiceClient();

  // Refuse to start with an empty player pool — the simulator/UI both need players.
  // Also recompute roster_size in case players were added since setup.
  const [{ count: playerCount }, { data: teamsData }] = await Promise.all([
    sb.from('players').select('id', { count: 'exact', head: true }).eq('draft_id', session.draftId),
    sb
      .from('teams')
      .select('id, name, captain_player_id')
      .eq('draft_id', session.draftId),
  ]);
  const teamCount = teamsData?.length ?? 0;
  if (!playerCount || playerCount === 0) {
    return NextResponse.json({ error: 'Add players before starting the draft.' }, { status: 409 });
  }
  if (teamCount === 0) {
    return NextResponse.json({ error: 'Add teams before starting the draft.' }, { status: 409 });
  }
  const teamsMissingCaptain = (teamsData ?? []).filter((t) => !t.captain_player_id);
  if (teamsMissingCaptain.length > 0) {
    const names = teamsMissingCaptain.map((t) => t.name).join(', ');
    return NextResponse.json(
      { error: `Every team needs a captain assigned. Missing: ${names}` },
      { status: 409 },
    );
  }

  const rosterSize = Math.ceil(playerCount / teamCount);

  // Lock every captain into their team's roster before the draft kicks off.
  // The captain's player row is flagged as drafted by their team, but no `picks`
  // row is inserted — captains sit outside the normal pick numbering.
  const { data: teamsWithCaptains } = await sb
    .from('teams')
    .select('id, captain_player_id')
    .eq('draft_id', session.draftId);
  for (const team of teamsWithCaptains ?? []) {
    if (!team.captain_player_id) continue;
    await sb
      .from('players')
      .update({
        drafted_by_team_id: team.id,
        reserved_for_team_id: null,
        claim_originator_pick_id: null,
      })
      .eq('id', team.captain_player_id);
  }

  const { error } = await sb
    .from('drafts')
    .update({
      status: 'active',
      roster_size: rosterSize,
      current_pick_number: 1,
      current_pick_started_at: new Date().toISOString(),
    })
    .eq('id', session.draftId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
