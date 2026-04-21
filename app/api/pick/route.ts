import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { teamForPick } from '@/lib/draft-logic';

type PickBody = {
  playerId: string;
  forTeamId?: string;     // commissioner-only override
  acknowledgeCapWarning?: boolean;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as PickBody | null;
  if (!body?.playerId) {
    return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });
  }

  const sb = createServiceClient();

  // Load draft + teams + picks + the player in one batch
  const [draftRes, teamsRes, picksRes, playerRes] = await Promise.all([
    sb.from('drafts').select('*').eq('id', session.draftId).single(),
    sb.from('teams').select('id, draft_position').eq('draft_id', session.draftId),
    sb.from('picks').select('*').eq('draft_id', session.draftId),
    sb.from('players').select('*').eq('id', body.playerId).single(),
  ]);

  if (draftRes.error || !draftRes.data) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }
  const draft = draftRes.data;
  const teams = teamsRes.data ?? [];
  const picks = picksRes.data ?? [];
  const player = playerRes.data;

  if (draft.status !== 'active') {
    return NextResponse.json({ error: 'Draft is not active' }, { status: 409 });
  }
  if (!player || player.draft_id !== draft.id) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }
  if (player.drafted_by_team_id) {
    return NextResponse.json({ error: 'Player already drafted' }, { status: 409 });
  }

  const { teamId: onClockTeamId, round } = teamForPick(
    draft.current_pick_number,
    teams,
    draft.draft_mode,
  );

  // Determine which team this pick is for
  let pickingTeamId: string;
  let pickedBy: 'team' | 'commissioner';
  if (session.isCommissioner) {
    pickingTeamId = body.forTeamId ?? onClockTeamId;
    pickedBy = 'commissioner';
  } else {
    if (!session.teamId) {
      return NextResponse.json({ error: 'No team in session' }, { status: 401 });
    }
    if (session.teamId !== onClockTeamId) {
      return NextResponse.json({ error: 'Not your turn' }, { status: 409 });
    }
    pickingTeamId = session.teamId;
    pickedBy = 'team';
  }

  // Soft cap check — drafted picks plus claimed (reserved-but-not-drafted) players
  // both count, since claims are guaranteed future picks for this team.
  const teamPickIds = picks.filter((p) => p.team_id === pickingTeamId).map((p) => p.player_id);
  const { data: draftedPlayers } = await sb
    .from('players')
    .select('point_value')
    .in('id', teamPickIds.length ? teamPickIds : ['00000000-0000-0000-0000-000000000000']);
  const { data: claimedPlayers } = await sb
    .from('players')
    .select('point_value')
    .eq('reserved_for_team_id', pickingTeamId)
    .is('drafted_by_team_id', null);
  const currentSpend =
    (draftedPlayers ?? []).reduce((s, p) => s + p.point_value, 0) +
    (claimedPlayers ?? []).reduce((s, p) => s + p.point_value, 0);
  // Don't double-count: if the player being picked IS a claim that's becoming a draft,
  // they're already in the spend. So only add their points if this isn't their own claim.
  const isFulfillingClaim = player.reserved_for_team_id === pickingTeamId;
  const after = isFulfillingClaim ? currentSpend : currentSpend + player.point_value;
  const wouldExceed = after > draft.salary_cap;

  if (wouldExceed && !body.acknowledgeCapWarning) {
    return NextResponse.json(
      {
        error: 'cap_warning',
        message: `This pick puts the team at ${after} / ${draft.salary_cap}. Confirm to override.`,
        currentSpend,
        afterSpend: after,
        cap: draft.salary_cap,
      },
      { status: 409 },
    );
  }

  // Atomically insert pick + mark player drafted + advance pick number
  const { data: insertedPick, error: pickErr } = await sb
    .from('picks')
    .insert({
      draft_id: draft.id,
      pick_number: draft.current_pick_number,
      round,
      team_id: pickingTeamId,
      player_id: player.id,
      picked_by: pickedBy,
    })
    .select('id')
    .single();
  if (pickErr || !insertedPick) {
    return NextResponse.json({ error: pickErr?.message ?? 'Pick insert failed' }, { status: 500 });
  }

  // Picking the player clears any reservation/originator-link it had.
  await sb
    .from('players')
    .update({
      drafted_by_team_id: pickingTeamId,
      reserved_for_team_id: null,
      claim_originator_pick_id: null,
    })
    .eq('id', player.id);

  // Player is now drafted — remove from everyone's stars.
  await sb.from('team_starred_players').delete().eq('player_id', player.id);

  // If the picked player is part of a package, claim the other package members
  // for the same team. Tag each claim with the originating pick id so undo can
  // distinguish the originator from a fulfillment.
  if (player.package_id) {
    await sb
      .from('players')
      .update({
        reserved_for_team_id: pickingTeamId,
        claim_originator_pick_id: insertedPick.id,
      })
      .eq('package_id', player.package_id)
      .neq('id', player.id)
      .is('drafted_by_team_id', null);
  }

  // Check completion
  const totalPicks = teams.length * draft.roster_size;
  const nextPickNumber = draft.current_pick_number + 1;
  const isComplete = nextPickNumber > totalPicks;

  await sb
    .from('drafts')
    .update({
      current_pick_number: isComplete ? draft.current_pick_number : nextPickNumber,
      current_pick_started_at: isComplete ? null : new Date().toISOString(),
      status: isComplete ? 'complete' : 'active',
      claim_skipped_for_pick: null,
    })
    .eq('id', draft.id);

  return NextResponse.json({ ok: true, complete: isComplete });
}
