'use client';

import { useState } from 'react';
import type { Player, Team } from '@/lib/supabase/types';
import { fmtPoints, positionBadge, positionBadgeClass } from '@/lib/utils';

export function ResolveClaimModal({
  team,
  claimedPlayers,
  picksRemainingForTeam,
  onClose,
  onPickClaim,
  onLetPick,
}: {
  team: Team;
  claimedPlayers: Player[];
  // How many picks (including this one) the team has left in the draft.
  // If <= claimedPlayers.length, "let them pick something else" is hidden —
  // they have no choice but to fulfill claims.
  picksRemainingForTeam: number;
  onClose: () => void;
  onPickClaim: (playerId: string) => Promise<void>;
  onLetPick: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const mustResolveAll = picksRemainingForTeam <= claimedPlayers.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4">
      <div className="bg-neutral-900 border border-violet-500/40 rounded-t-lg sm:rounded-lg w-full max-w-md p-4 sm:p-6 space-y-4">
        <header className="space-y-1">
          <p className="text-violet-300 text-xs uppercase tracking-widest">On hold</p>
          <h2 className="text-xl font-bold">
            {team.name}
            {team.captain_name && (
              <span className="text-neutral-400 font-normal text-sm"> ({team.captain_name})</span>
            )}{' '}
            has claimed players
          </h2>
          <p className="text-sm text-neutral-400">
            Decide what to do with this round&apos;s pick before going on the clock.
          </p>
        </header>

        <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
          {claimedPlayers.map((p) => (
            <li key={p.id} className="px-3 py-3 flex items-center gap-3">
              <span
                className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                  p.position,
                )}`}
              >
                {positionBadge(p.position)}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`truncate ${p.gender === 'F' ? 'italic text-pink-300' : ''}`}>
                  {p.first_name} {p.last_name}
                </p>
                <p className="text-xs text-neutral-500">{fmtPoints(p.point_value)} pts</p>
              </div>
              <button
                onClick={async () => {
                  setBusy(p.id);
                  await onPickClaim(p.id);
                  setBusy(null);
                }}
                disabled={!!busy}
                className="rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
              >
                {busy === p.id ? 'Picking…' : 'Use this pick'}
              </button>
            </li>
          ))}
        </ul>

        {mustResolveAll ? (
          <p className="text-xs text-amber-300">
            This team has no remaining picks beyond their claims — one of these must be used now.
          </p>
        ) : (
          <button
            onClick={() => {
              onLetPick();
              onClose();
            }}
            disabled={!!busy}
            className="w-full rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold py-3 disabled:opacity-50"
          >
            Skip — let them pick someone else this round
          </button>
        )}

        <p className="text-[11px] text-neutral-500 text-center">
          Picks remaining for this team: {picksRemainingForTeam} · Claims: {claimedPlayers.length}
        </p>
      </div>
    </div>
  );
}
