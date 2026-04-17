import type { DraftMode, DraftPick, Player, Team } from './supabase/types';

export type PickSlot = {
  pickNumber: number;
  round: number;
  teamId: string;
  draftPosition: number;
};

// Given team count and mode, compute the team that owns pick N (1-indexed).
export function teamForPick(
  pickNumber: number,
  teams: Pick<Team, 'id' | 'draft_position'>[],
  mode: DraftMode,
): { teamId: string; round: number; draftPosition: number } {
  const n = teams.length;
  if (n === 0) throw new Error('No teams');
  const sorted = [...teams].sort((a, b) => a.draft_position - b.draft_position);

  const zeroIdx = pickNumber - 1;
  const round = Math.floor(zeroIdx / n) + 1;
  const posInRound = zeroIdx % n;

  const reversed = mode === 'snake' && round % 2 === 0;
  const slotIdx = reversed ? n - 1 - posInRound : posInRound;
  const team = sorted[slotIdx];

  return { teamId: team.id, round, draftPosition: team.draft_position };
}

export function buildFullSchedule(
  teams: Pick<Team, 'id' | 'draft_position'>[],
  mode: DraftMode,
  rosterSize: number,
): PickSlot[] {
  const total = teams.length * rosterSize;
  const slots: PickSlot[] = [];
  for (let i = 1; i <= total; i++) {
    const { teamId, round, draftPosition } = teamForPick(i, teams, mode);
    slots.push({ pickNumber: i, round, teamId, draftPosition });
  }
  return slots;
}

export function teamCapUsed(
  teamId: string,
  picks: DraftPick[],
  players: Pick<Player, 'id' | 'point_value' | 'drafted_by_team_id' | 'reserved_for_team_id'>[],
): number {
  const playerById = new Map(players.map((p) => [p.id, p]));
  // Drafted picks count
  const drafted = picks
    .filter((p) => p.team_id === teamId)
    .reduce((sum, p) => sum + (playerById.get(p.player_id)?.point_value ?? 0), 0);
  // Claimed (reserved-but-not-drafted) players also count — they belong to this team.
  const claimed = players
    .filter((p) => p.reserved_for_team_id === teamId && !p.drafted_by_team_id)
    .reduce((sum, p) => sum + p.point_value, 0);
  return drafted + claimed;
}

export function wouldExceedCap(
  currentUsed: number,
  candidatePoints: number,
  cap: number,
): boolean {
  return currentUsed + candidatePoints > cap;
}

export type RosterCounts = {
  F: number;
  D: number;
  G: number;
  FD: number;
  M: number;
  W: number;
  total: number;
};

export function rosterCounts(
  teamId: string,
  picks: DraftPick[],
  players: Pick<Player, 'id' | 'position' | 'gender'>[],
): RosterCounts {
  const playerById = new Map(players.map((p) => [p.id, p]));
  const counts: RosterCounts = { F: 0, D: 0, G: 0, FD: 0, M: 0, W: 0, total: 0 };
  for (const pick of picks) {
    if (pick.team_id !== teamId) continue;
    const pl = playerById.get(pick.player_id);
    if (!pl) continue;
    counts[pl.position] += 1;
    if (pl.gender === 'F') counts.W += 1;
    else counts.M += 1;
    counts.total += 1;
  }
  return counts;
}
