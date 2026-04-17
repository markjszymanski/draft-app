'use client';

import type { Draft, DraftPick, Player, Team } from '@/lib/supabase/types';
import { buildFullSchedule } from '@/lib/draft-logic';

export function DraftOrderPanel({
  draft,
  teams,
  picks,
  players,
}: {
  draft: Draft;
  teams: Team[];
  picks: DraftPick[];
  players: Player[];
}) {
  const schedule = buildFullSchedule(teams, draft.draft_mode, draft.roster_size);
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamCount = teams.length;
  const fmtPickLabel = (round: number, pickNumber: number) =>
    `${round}.${(((pickNumber - 1) % teamCount) + 1).toString().padStart(2, '0')}`;

  const isActive = draft.status === 'active';
  const recent = picks.slice(-8).reverse();
  const upcoming = isActive
    ? schedule.filter((s) => s.pickNumber >= draft.current_pick_number).slice(0, 8)
    : [];

  return (
    <div className="p-4 space-y-6">
      {isActive && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Up next</h3>
          <ol className="space-y-1">
            {upcoming.map((s) => {
              const team = teamById.get(s.teamId);
              const isCurrent = s.pickNumber === draft.current_pick_number;
              return (
                <li
                  key={s.pickNumber}
                  className={`flex items-center gap-3 px-3 py-2 rounded ${
                    isCurrent ? 'bg-emerald-500/10 border border-emerald-500/40' : ''
                  }`}
                >
                  <span className="text-xs text-neutral-500 tabular-nums w-14">
                    {fmtPickLabel(s.round, s.pickNumber)}
                  </span>
                  <span className="flex-1">
                    {team?.name ?? '—'}
                    {team?.captain_name && (
                      <span className="text-neutral-500"> ({team.captain_name})</span>
                    )}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-emerald-400 font-semibold">ON THE CLOCK</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Recent picks</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-neutral-500">No picks yet.</p>
        ) : (
          <ol className="space-y-1">
            {recent.map((pick) => {
              const team = teamById.get(pick.team_id);
              const player = playerById.get(pick.player_id);
              return (
                <li key={pick.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="text-xs text-neutral-500 tabular-nums w-14">
                    {fmtPickLabel(pick.round, pick.pick_number)}
                  </span>
                  <span className="text-sm text-neutral-400 w-40 truncate">
                    {team?.name}
                    {team?.captain_name && (
                      <span className="text-neutral-600"> ({team.captain_name})</span>
                    )}
                  </span>
                  <span className="flex-1 truncate">
                    {player ? `${player.first_name} ${player.last_name}` : '—'}
                  </span>
                  {player && (
                    <span className="text-xs tabular-nums text-neutral-400">
                      {player.point_value}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
