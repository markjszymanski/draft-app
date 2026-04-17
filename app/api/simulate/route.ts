import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { teamForPick, rosterCounts } from '@/lib/draft-logic';
import type { Player } from '@/lib/supabase/types';

type Body = { mode?: 'one' | 'all' };

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  const mode = body.mode ?? 'one';

  const sb = createServiceClient();
  let picksMade = 0;
  const maxIterations = mode === 'all' ? 1000 : 1;

  for (let i = 0; i < maxIterations; i++) {
    const [{ data: draft }, { data: teams }, { data: players }, { data: picks }] =
      await Promise.all([
        sb.from('drafts').select('*').eq('id', session.draftId).single(),
        sb.from('teams').select('id, draft_position').eq('draft_id', session.draftId),
        sb.from('players').select('*').eq('draft_id', session.draftId),
        sb.from('picks').select('*').eq('draft_id', session.draftId),
      ]);

    if (!draft || !teams || !players || !picks) break;
    if (draft.status !== 'active') break;

    const totalPicks = teams.length * draft.roster_size;
    if (draft.current_pick_number > totalPicks) break;

    const { teamId, round } = teamForPick(
      draft.current_pick_number,
      teams,
      draft.draft_mode,
    );

    const pick = chooseRandomPlayer(teamId, players, picks, draft.salary_cap, draft.roster_size);
    if (!pick) {
      // Pool exhausted before all roster slots filled — finalize the draft.
      await sb
        .from('drafts')
        .update({ status: 'complete', current_pick_started_at: null })
        .eq('id', draft.id);
      break;
    }

    const { data: insertedPick } = await sb
      .from('picks')
      .insert({
        draft_id: draft.id,
        pick_number: draft.current_pick_number,
        round,
        team_id: teamId,
        player_id: pick.id,
        picked_by: 'commissioner',
      })
      .select('id')
      .single();
    await sb
      .from('players')
      .update({
        drafted_by_team_id: teamId,
        reserved_for_team_id: null,
        claim_originator_pick_id: null,
      })
      .eq('id', pick.id);
    await sb.from('team_starred_players').delete().eq('player_id', pick.id);

    if (pick.package_id && insertedPick) {
      await sb
        .from('players')
        .update({
          reserved_for_team_id: teamId,
          claim_originator_pick_id: insertedPick.id,
        })
        .eq('package_id', pick.package_id)
        .neq('id', pick.id)
        .is('drafted_by_team_id', null);
    }

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

    picksMade++;
    if (isComplete) break;
  }

  return NextResponse.json({ ok: true, picksMade });
}

function chooseRandomPlayer(
  teamId: string,
  players: Player[],
  picks: { team_id: string; player_id: string }[],
  cap: number,
  rosterSize: number,
): Player | null {
  const available = players.filter((p) => !p.drafted_by_team_id);
  if (available.length === 0) return null;

  const counts = rosterCounts(
    teamId,
    picks as unknown as Parameters<typeof rosterCounts>[1],
    players,
  );
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamSpend = picks
    .filter((p) => p.team_id === teamId)
    .reduce((s, p) => s + (playerById.get(p.player_id)?.point_value ?? 0), 0);
  const remaining = cap - teamSpend;
  const slotsLeft = rosterSize - counts.total;
  const avgBudgetPerSlot = slotsLeft > 0 ? remaining / slotsLeft : 0;

  // Position need: prioritize goalie if none, then balance F/D
  const needGoalie = counts.G === 0;

  // Filter to candidates that wouldn't cripple cap (allow some headroom)
  const affordable = available.filter((p) => {
    if (slotsLeft <= 1) return teamSpend + p.point_value <= cap * 1.05;
    return p.point_value <= avgBudgetPerSlot * 2.5;
  });
  const pool = affordable.length > 0 ? affordable : available;

  // Position preference
  let preferred = pool;
  if (needGoalie) {
    const goalies = pool.filter((p) => p.position === 'G');
    if (goalies.length > 0) preferred = goalies;
  } else {
    // Pick whichever position is most underrepresented (loose target: 60% F, 30% D, 10% G)
    const targets = { F: 0.6, D: 0.3, G: 0.1 } as const;
    const filled = counts.total || 1;
    const ratios = {
      F: counts.F / filled,
      D: counts.D / filled,
      G: counts.G / filled,
    };
    const deficits = {
      F: targets.F - ratios.F,
      D: targets.D - ratios.D,
      G: targets.G - ratios.G,
    };
    const wantPos = (Object.entries(deficits) as [keyof typeof deficits, number][])
      .sort((a, b) => b[1] - a[1])[0][0];
    const want = pool.filter((p) => p.position === wantPos);
    if (want.length > 0) preferred = want;
  }

  // Weight toward higher point values so the simulation isn't completely flat
  const weighted = preferred
    .map((p) => ({ p, w: p.point_value + 50 }))
    .sort((a, b) => b.w - a.w);
  const top = weighted.slice(0, Math.max(3, Math.ceil(weighted.length * 0.3)));
  const choice = top[Math.floor(Math.random() * top.length)];
  return choice.p;
}
