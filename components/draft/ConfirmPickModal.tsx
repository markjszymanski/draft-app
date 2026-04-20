'use client';

import { useState } from 'react';
import type { Player, Team } from '@/lib/supabase/types';
import { fmtPoints, positionLabel } from '@/lib/utils';

export function ConfirmPickModal({
  player,
  team,
  cap,
  currentSpend,
  counts,
  rosterSize,
  allPlayers,
  allTeams,
  error,
  onCancel,
  onConfirm,
}: {
  player: Player;
  team: Team | null;
  cap: number;
  currentSpend: number;
  counts: { F: number; D: number; G: number; FD: number; M: number; W: number; total: number };
  rosterSize: number;
  allPlayers: Player[];
  allTeams: Team[];
  error: string | null;
  onCancel: () => void;
  onConfirm: (acknowledgeCapWarning: boolean) => Promise<{ ok?: boolean; capWarning?: unknown; error?: string } | undefined>;
}) {
  const [busy, setBusy] = useState(false);
  const [needsAck, setNeedsAck] = useState(false);

  const after = currentSpend + player.point_value;
  const wouldExceed = after > cap;

  // Package teammates that aren't already drafted. They'll be reserved if this pick goes through.
  const packageMates = player.package_id
    ? allPlayers.filter(
        (other) =>
          other.id !== player.id &&
          other.package_id === player.package_id &&
          !other.drafted_by_team_id,
      )
    : [];
  const teamById = new Map(allTeams.map((t) => [t.id, t]));

  async function go() {
    setBusy(true);
    const result = await onConfirm(needsAck || wouldExceed);
    setBusy(false);
    if (result?.capWarning) setNeedsAck(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-t-lg sm:rounded-lg w-full max-w-md p-4 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2 className="text-xl font-semibold">Confirm pick</h2>
          {team && (
            <p className="text-xs text-neutral-400">
              For {team.name}
              {team.captain_name && ` (${team.captain_name})`}
            </p>
          )}
        </header>

        <div className="bg-neutral-950 rounded p-4 space-y-1">
          <p className="text-lg font-semibold">
            {player.first_name} {player.last_name}
          </p>
          <p className="text-sm text-neutral-400">
            {positionLabel(player.position)} · {player.gender === 'F' ? 'Woman' : 'Man'} ·{' '}
            {fmtPoints(player.point_value)} pts
          </p>
        </div>

        {team && (
          <div className="text-sm space-y-1">
            <p className="text-neutral-400">
              Cap: {fmtPoints(currentSpend)} → <span className={wouldExceed ? 'text-rose-400 font-semibold' : 'text-neutral-200'}>{fmtPoints(after)}</span> / {fmtPoints(cap)}
            </p>
            <p className="text-neutral-400">
              Roster: {counts.total + 1} / {rosterSize} · F:{counts.F + (player.position === 'F' ? 1 : 0)} D:{counts.D + (player.position === 'D' ? 1 : 0)} <span className="text-violet-300">F/D:{counts.FD + (player.position === 'FD' ? 1 : 0)}</span> G:{counts.G + (player.position === 'G' ? 1 : 0)}
            </p>
            <p className="text-neutral-400">
              <span className="text-sky-300">M:{counts.M + (player.gender === 'M' ? 1 : 0)}</span>{' '}
              <span className="text-pink-300">W:{counts.W + (player.gender === 'F' ? 1 : 0)}</span>
            </p>
          </div>
        )}

        {packageMates.length > 0 && (
          <div className="rounded border border-violet-500/40 bg-violet-500/10 p-3 text-sm space-y-2">
            <p className="text-violet-200 font-semibold">
              👥 Package — these teammates will be reserved for {team?.name ?? 'the team'}:
            </p>
            <ul className="text-violet-100 space-y-0.5">
              {packageMates.map((m) => {
                const conflict = m.reserved_for_team_id && m.reserved_for_team_id !== team?.id;
                const conflictTeam = conflict ? teamById.get(m.reserved_for_team_id!) : null;
                return (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="font-mono text-xs w-8 text-center">{m.position === 'FD' ? 'F/D' : m.position}</span>
                    <span className={m.gender === 'F' ? 'italic text-pink-200' : ''}>
                      {m.first_name} {m.last_name}
                    </span>
                    <span className="ml-auto text-xs text-violet-200">
                      {fmtPoints(m.point_value)}
                    </span>
                    {conflictTeam && (
                      <span className="text-xs text-amber-300 ml-2">
                        already reserved for {conflictTeam.name}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-violet-300">
              Reservations are advisory — the commissioner still picks them when their turn comes.
            </p>
          </div>
        )}

        {wouldExceed && (
          <div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">
            ⚠️ This pick puts the team over the salary cap. Confirm with the league commissioner before proceeding.
          </div>
        )}

        {error && !error.includes('cap') && (
          <p className="text-sm text-rose-400">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 rounded-md bg-neutral-800 hover:bg-neutral-700 py-3 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={go}
            disabled={busy}
            className={`flex-1 rounded-md font-semibold py-3 disabled:opacity-50 ${
              wouldExceed
                ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950'
            }`}
          >
            {busy ? 'Picking…' : wouldExceed ? 'Override cap & pick' : 'Confirm pick'}
          </button>
        </div>
      </div>
    </div>
  );
}
