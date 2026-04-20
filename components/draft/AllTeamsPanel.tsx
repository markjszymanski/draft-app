'use client';

import { useState } from 'react';
import type { DraftPick, Player, Team } from '@/lib/supabase/types';
import { teamCapUsed, rosterCounts } from '@/lib/draft-logic';
import { fmtPoints, positionBadge, positionBadgeClass } from '@/lib/utils';

export function AllTeamsPanel({
  teams,
  players,
  picks,
  cap,
  rosterSize,
  highlightTeamId,
}: {
  teams: Team[];
  players: Player[];
  picks: DraftPick[];
  cap: number;
  rosterSize: number;
  highlightTeamId?: string | null;
}) {
  const teamCount = teams.length;
  const playerById = new Map(players.map((p) => [p.id, p]));
  const sortedTeams = [...teams].sort((a, b) => a.draft_position - b.draft_position);
  const [openId, setOpenId] = useState<string | null>(highlightTeamId ?? null);

  return (
    <div className="p-3 space-y-2">
      {sortedTeams.map((team) => {
        const used = teamCapUsed(team.id, picks, players);
        const counts = rosterCounts(team.id, picks, players);
        const pct = Math.min(100, Math.round((used / cap) * 100));
        const over = used > cap;
        const myPicks = picks
          .filter((p) => p.team_id === team.id)
          .sort((a, b) => a.pick_number - b.pick_number);
        const isOpen = openId === team.id;
        const isHighlight = highlightTeamId === team.id;

        return (
          <div
            key={team.id}
            className={`rounded border ${
              isHighlight ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-neutral-800 bg-neutral-900/50'
            }`}
          >
            <button
              onClick={() => setOpenId(isOpen ? null : team.id)}
              className="w-full text-left p-3 flex items-center gap-3"
            >
              <span className="text-xs text-neutral-500 tabular-nums w-6">
                #{team.draft_position}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {team.name}
                  {team.captain_name && (
                    <span className="text-neutral-400 font-normal"> ({team.captain_name})</span>
                  )}
                </p>
                <div className="mt-1 h-1.5 bg-neutral-900 rounded overflow-hidden">
                  <div
                    className={`h-full ${
                      over ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-right text-xs text-neutral-400 shrink-0">
                <p className={`tabular-nums ${over ? 'text-rose-400' : ''}`}>
                  {fmtPoints(used)} / {fmtPoints(cap)}
                </p>
                <p>
                  {counts.total}/{rosterSize} · F{counts.F} D{counts.D}{' '}
                  <span className="text-violet-300">F/D{counts.FD}</span> G{counts.G} ·{' '}
                  <span className="text-sky-300">M{counts.M}</span>{' '}
                  <span className="text-pink-300">W{counts.W}</span>
                </p>
              </div>
              <span className="text-neutral-500 text-xs ml-1">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-neutral-800 px-3 py-2">
                {(() => {
                  const captain = team.captain_player_id
                    ? playerById.get(team.captain_player_id) ?? null
                    : null;
                  if (!captain && myPicks.length === 0) {
                    return <p className="text-sm text-neutral-500 py-1">No picks yet.</p>;
                  }
                  return (
                    <ul className="divide-y divide-neutral-800">
                      {captain && (
                        <li className="py-1.5 flex items-center gap-3 text-sm">
                          <span className="text-xs font-semibold text-amber-400 tabular-nums w-12 text-center">
                            C
                          </span>
                          <span
                            className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                              captain.position,
                            )}`}
                          >
                            {positionBadge(captain.position)}
                          </span>
                          <span
                            className={`flex-1 truncate ${
                              captain.gender === 'F' ? 'italic text-pink-300' : ''
                            }`}
                          >
                            {captain.first_name} {captain.last_name}
                          </span>
                          <span className="text-xs tabular-nums text-neutral-400">
                            {captain.point_value}
                          </span>
                        </li>
                      )}
                      {myPicks.map((pick) => {
                        const player = playerById.get(pick.player_id);
                        if (!player) return null;
                        return (
                          <li key={pick.id} className="py-1.5 flex items-center gap-3 text-sm">
                            <span className="text-xs text-neutral-500 tabular-nums w-12">
                              {pick.round}.{(((pick.pick_number - 1) % teamCount) + 1).toString().padStart(2, '0')}
                            </span>
                            <span
                              className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                                player.position,
                              )}`}
                            >
                              {positionBadge(player.position)}
                            </span>
                            <span
                              className={`flex-1 truncate ${
                                player.gender === 'F' ? 'italic text-pink-300' : ''
                              }`}
                            >
                              {player.first_name} {player.last_name}
                            </span>
                            <span className="text-xs tabular-nums text-neutral-400">
                              {player.point_value}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
