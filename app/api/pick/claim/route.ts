import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { teamForPick } from '@/lib/draft-logic';

// Use the current pick number to fulfill a previously-claimed player.
// Different from /api/pick because the player is already part of this team's
// cap (claimed) — we just promote them to drafted at this round.

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { playerId?: string } | null;
  if (!body?.playerId) {
    return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
  }

  const sb = createServiceClient();
  const [draftRes, teamsRes, playerRes] = await Promise.all([
    sb.from('drafts').select('*').eq('id', session.draftId).single(),
    sb.from('teams').select('id, draft_position').eq('draft_id', session.draftId),
    sb.from('players').select('*').eq('id', body.playerId).single(),
  ]);
  if (!draftRes.data) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  const draft = draftRes.data;
  const teams = teamsRes.data ?? [];
  const player = playerRes.data;
  if (draft.status !== 'active') {
    return NextResponse.json({ error: 'Draft is not active' }, { status: 409 });
  }
  if (!player || player.drafted_by_team_id) {
    return NextResponse.json({ error: 'Player not draftable' }, { status: 409 });
  }
  if (!player.reserved_for_team_id) {
    return NextResponse.json({ error: 'Player has no claim' }, { status: 409 });
  }

  const { teamId: onClockTeamId, round } = teamForPick(
    draft.current_pick_number,
    teams,
    draft.draft_mode,
  );

  // Authorization: commissioner, or the team that holds the claim AND is on the clock.
  if (!session.isCommissioner) {
    if (session.teamId !== onClockTeamId) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 409 });
    }
    if (player.reserved_for_team_id !== session.teamId) {
      return NextResponse.json({ error: 'Not your claim' }, { status: 403 });
    }
  } else {
    // Commissioner can only fulfill the on-clock team's claims through this endpoint
    if (player.reserved_for_team_id !== onClockTeamId) {
      return NextResponse.json(
        { error: "Only the on-clock team's claims can be fulfilled this round." },
        { status: 409 },
      );
    }
  }

  const pickedBy = session.isCommissioner ? 'commissioner' : 'team';

  const { error: pickErr } = await sb.from('picks').insert({
    draft_id: draft.id,
    pick_number: draft.current_pick_number,
    round,
    team_id: onClockTeamId,
    player_id: player.id,
    picked_by: pickedBy,
  });
  if (pickErr) return NextResponse.json({ error: pickErr.message }, { status: 500 });

  await sb
    .from('players')
    .update({
      drafted_by_team_id: onClockTeamId,
      reserved_for_team_id: null,
      claim_originator_pick_id: null,
    })
    .eq('id', player.id);
  await sb.from('team_starred_players').delete().eq('player_id', player.id);

  const totalPicks = teams.length * draft.roster_size;
  const nextPickNumber = draft.current_pick_number + 1;
  const isComplete = nextPickNumber > totalPicks;
  await sb
    .from('drafts')
    .update({
      current_pick_number: isComplete ? draft.current_pick_number : nextPickNumber,
      current_pick_started_at: isComplete ? null : new Date().toISOString(),
      status: isComplete ? 'complete' : 'active',
    })
    .eq('id', draft.id);

  return NextResponse.json({ ok: true, complete: isComplete });
}
