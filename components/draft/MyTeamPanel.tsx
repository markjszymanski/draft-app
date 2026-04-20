'use client';

import type { Player, DraftPick, Team } from '@/lib/supabase/types';
import { teamCapUsed, rosterCounts } from '@/lib/draft-logic';
import { fmtPoints, positionBadge, positionBadgeClass } from '@/lib/utils';

export function MyTeamPanel({
  team,
  players,
  picks,
  cap,
  teamCount,
}: {
  team: Team | null;
  players: Player[];
  picks: DraftPick[];
  cap: number;
  teamCount: number;
}) {
  if (!team) {
    return (
      <div className="p-6 text-center text-neutral-400 text-sm">
        No team selected — switch to the All Teams tab.
      </div>
    );
  }

  const playerById = new Map(players.map((p) => [p.id, p]));
  const myPicks = picks
    .filter((p) => p.team_id === team.id)
    .sort((a, b) => a.pick_number - b.pick_number);
  const captain = team.captain_player_id ? playerById.get(team.captain_player_id) ?? null : null;
  const used = teamCapUsed(team.id, picks, players);
  const counts = rosterCounts(team.id, picks, players);
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const over = used > cap;

  return (
    <div className="p-4 space-y-4">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">
            {team.name}
            {team.captain_name && (
              <span className="text-neutral-400 font-normal"> ({team.captain_name})</span>
            )}
          </h2>
          <span className={`text-sm tabular-nums ${over ? 'text-rose-400' : 'text-neutral-300'}`}>
            {fmtPoints(used)} / {fmtPoints(cap)}
          </span>
        </div>
        <div className="h-2 bg-neutral-900 rounded overflow-hidden">
          <div
            className={`h-full ${over ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex gap-3 text-xs text-neutral-400 flex-wrap">
          <span>F: {counts.F}</span>
          <span>D: {counts.D}</span>
          <span className="text-violet-300">F/D: {counts.FD}</span>
          <span>G: {counts.G}</span>
          <span className="text-neutral-600">·</span>
          <span className="text-sky-300">M: {counts.M}</span>
          <span className="text-pink-300">W: {counts.W}</span>
          <span className="ml-auto">Total: {counts.total}</span>
        </div>
      </section>

      <section>
        <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Roster</h3>
        {!captain && myPicks.length === 0 ? (
          <p className="text-sm text-neutral-500">No picks yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-900">
            {captain && (
              <li className="py-2 flex items-center gap-3">
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
                <span className="text-sm tabular-nums text-neutral-300">
                  {fmtPoints(captain.point_value)}
                </span>
              </li>
            )}
            {myPicks.map((pick) => {
              const player = playerById.get(pick.player_id);
              if (!player) return null;
              return (
                <li key={pick.id} className="py-2 flex items-center gap-3">
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
                  <span className="text-sm tabular-nums text-neutral-300">
                    {fmtPoints(player.point_value)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {(() => {
        const claimed = players.filter(
          (p) => p.reserved_for_team_id === team.id && !p.drafted_by_team_id,
        );
        if (claimed.length === 0) return null;
        return (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-violet-300 mb-2">
              👥 Claimed ({claimed.length}) — to be assigned a round
            </h3>
            <ul className="divide-y divide-neutral-900 rounded border border-violet-500/30 bg-violet-500/5">
              {claimed.map((player) => (
                <li key={player.id} className="py-2 px-3 flex items-center gap-3">
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
                  <span className="text-sm tabular-nums text-neutral-300">
                    {fmtPoints(player.point_value)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-neutral-500 mt-1">
              Cap counted. The commissioner will assign each to a future round when this team is on the clock.
            </p>
          </section>
        );
      })()}
    </div>
  );
}
