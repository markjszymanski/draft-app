'use client';

import { useMemo } from 'react';
import { useDraftState } from '@/hooks/useDraftState';
import { teamForPick, teamCapUsed, rosterCounts } from '@/lib/draft-logic';
import { PickTimer } from '@/components/draft/PickTimer';
import { fmtPoints, positionBadge, positionBadgeClass } from '@/lib/utils';

export function WatchView({ draftId }: { draftId: string }) {
  const { draft, teams, players, picks, loading } = useDraftState(draftId);

  const onClock = useMemo(() => {
    if (!draft || teams.length === 0 || draft.status !== 'active') return null;
    return teamForPick(draft.current_pick_number, teams, draft.draft_mode);
  }, [draft, teams]);

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.draft_position - b.draft_position),
    [teams],
  );

  if (loading || !draft) {
    return (
      <main className="flex-1 flex items-center justify-center text-2xl text-neutral-400">
        Loading draft…
      </main>
    );
  }

  const onClockTeam = teams.find((t) => t.id === onClock?.teamId) ?? null;
  const lastPick = picks.length > 0 ? picks[picks.length - 1] : null;
  const lastPickTeam = lastPick ? teams.find((t) => t.id === lastPick.team_id) : null;
  const lastPickPlayer = lastPick ? players.find((p) => p.id === lastPick.player_id) : null;
  const playerById = new Map(players.map((p) => [p.id, p]));

  return (
    <main className="flex-1 flex flex-col p-6 gap-6">
      <header className="flex items-center justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
            {draft.name} · {draft.year}
          </p>
          {draft.status === 'setup' && (
            <h1 className="text-5xl font-bold mt-2">Waiting to start…</h1>
          )}
          {draft.status === 'active' && onClockTeam && (
            <>
              <p className="text-2xl text-neutral-400 mt-2">
                Pick #{draft.current_pick_number} · Round {onClock?.round}
              </p>
              <h1 className="text-6xl font-bold mt-1">
                <span className="text-emerald-400">On the clock:</span> {onClockTeam.name}
                {onClockTeam.captain_name && (
                  <span className="text-neutral-400 font-normal text-4xl">
                    {' '}
                    ({onClockTeam.captain_name})
                  </span>
                )}
              </h1>
            </>
          )}
          {draft.status === 'complete' && (
            <h1 className="text-6xl font-bold mt-2 text-emerald-400">DRAFT COMPLETE</h1>
          )}
        </div>
        {draft.status === 'active' && draft.current_pick_started_at && (
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-neutral-500">Time</p>
            <div className="scale-[2] origin-right mt-2">
              <PickTimer
                startedAt={draft.current_pick_started_at}
                durationSeconds={draft.pick_timer_seconds}
              />
            </div>
          </div>
        )}
      </header>

      {lastPick && lastPickTeam && lastPickPlayer && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-neutral-500">Last pick</p>
            <p className="text-2xl font-semibold mt-1">
              {lastPickTeam.name}
              {lastPickTeam.captain_name && (
                <span className="text-neutral-400 font-normal text-lg"> ({lastPickTeam.captain_name})</span>
              )}
              <span className="text-neutral-500 mx-3">→</span>
              {lastPickPlayer.first_name} {lastPickPlayer.last_name}
              <span className="ml-3 text-base text-neutral-400">
                {lastPickPlayer.position} · {fmtPoints(lastPickPlayer.point_value)} pts
              </span>
            </p>
          </div>
        </section>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4 overflow-hidden">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 overflow-auto content-start">
        {sortedTeams.map((team) => {
          const used = teamCapUsed(team.id, picks, players);
          const counts = rosterCounts(team.id, picks, players);
          const pct = Math.min(100, Math.round((used / draft.salary_cap) * 100));
          const over = used > draft.salary_cap;
          const isOnClock = onClock?.teamId === team.id;
          const teamPicks = picks
            .filter((p) => p.team_id === team.id)
            .sort((a, b) => a.pick_number - b.pick_number);
          const teamCount = teams.length;

          return (
            <div
              key={team.id}
              className={`rounded-lg border p-3 flex flex-col ${
                isOnClock
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-neutral-800 bg-neutral-900/50'
              }`}
            >
              <header className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500 tabular-nums">#{team.draft_position}</p>
                  <p className="font-semibold truncate">{team.name}</p>
                  {team.captain_name && (
                    <p className="text-xs text-neutral-400 truncate">{team.captain_name}</p>
                  )}
                </div>
                {isOnClock && (
                  <span className="text-[10px] font-bold text-emerald-400 tracking-widest shrink-0">
                    ON THE CLOCK
                  </span>
                )}
              </header>

              <div className="mt-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-neutral-400">
                    {counts.total}/{draft.roster_size} ·{' '}
                    F{counts.F} D{counts.D}{' '}
                    <span className="text-violet-300">F/D{counts.FD}</span> G{counts.G} ·{' '}
                    <span className="text-sky-300">M{counts.M}</span>{' '}
                    <span className="text-pink-300">W{counts.W}</span>
                  </span>
                  <span className={`tabular-nums ${over ? 'text-rose-400' : 'text-neutral-300'}`}>
                    {fmtPoints(used)} / {fmtPoints(draft.salary_cap)}
                  </span>
                </div>
                <div className="h-1.5 bg-neutral-900 rounded mt-1 overflow-hidden">
                  <div
                    className={`h-full ${
                      over ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <ul className="mt-2 text-xs space-y-0.5 overflow-hidden">
                {(() => {
                  const captain = team.captain_player_id
                    ? playerById.get(team.captain_player_id) ?? null
                    : null;
                  const rows: React.ReactNode[] = [];
                  if (captain) {
                    rows.push(
                      <li key={`captain-${captain.id}`} className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] font-semibold text-amber-400 tabular-nums w-9 shrink-0 text-center">
                          C
                        </span>
                        <span
                          className={`px-1 rounded text-[10px] font-bold ${positionBadgeClass(
                            captain.position,
                          )}`}
                        >
                          {positionBadge(captain.position)}
                        </span>
                        <span
                          className={`truncate ${
                            captain.gender === 'F' ? 'italic text-pink-300' : ''
                          }`}
                        >
                          {captain.first_name[0]}. {captain.last_name}
                        </span>
                        <span className="ml-auto tabular-nums text-neutral-500">
                          {captain.point_value}
                        </span>
                      </li>,
                    );
                  }
                  for (const pick of teamPicks) {
                    const player = playerById.get(pick.player_id);
                    if (!player) continue;
                    const pickInRound = ((pick.pick_number - 1) % teamCount) + 1;
                    const label = `${pick.round}.${pickInRound.toString().padStart(2, '0')}`;
                    rows.push(
                      <li key={pick.id} className="flex items-center gap-1.5 truncate">
                        <span className="text-[10px] tabular-nums text-neutral-500 w-9 shrink-0">
                          {label}
                        </span>
                        <span
                          className={`px-1 rounded text-[10px] font-bold ${positionBadgeClass(
                            player.position,
                          )}`}
                        >
                          {positionBadge(player.position)}
                        </span>
                        <span
                          className={`truncate ${
                            player.gender === 'F' ? 'italic text-pink-300' : ''
                          }`}
                        >
                          {player.first_name[0]}. {player.last_name}
                        </span>
                        <span className="ml-auto tabular-nums text-neutral-500">
                          {player.point_value}
                        </span>
                      </li>,
                    );
                  }
                  if (rows.length === 0) {
                    rows.push(<li key="empty" className="text-neutral-600">No picks yet</li>);
                  }
                  return rows;
                })()}
              </ul>
            </div>
          );
        })}
      </section>

      <aside className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 flex flex-col overflow-hidden">
        <header className="flex items-baseline justify-between mb-2">
          <h2 className="text-xs uppercase tracking-widest text-neutral-500">Best available</h2>
          <span className="text-xs text-neutral-500">
            {players.filter((p) => !p.drafted_by_team_id).length} left
          </span>
        </header>
        <ul className="space-y-1 overflow-auto text-sm">
          {players
            .filter((p) => !p.drafted_by_team_id)
            .sort((a, b) => b.point_value - a.point_value)
            .slice(0, 20)
            .map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span
                  className={`w-9 text-center text-[10px] font-bold rounded ${positionBadgeClass(
                    p.position,
                  )}`}
                >
                  {positionBadge(p.position)}
                </span>
                <span
                  className={`flex-1 truncate ${
                    p.gender === 'F' ? 'italic text-pink-300' : ''
                  }`}
                >
                  {p.first_name} {p.last_name}
                </span>
                <span className="tabular-nums text-neutral-400 text-xs">
                  {fmtPoints(p.point_value)}
                </span>
              </li>
            ))}
        </ul>
      </aside>
      </div>
    </main>
  );
}
