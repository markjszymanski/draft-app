'use client';

import { useState } from 'react';
import type { Draft, DraftPick, Player, Team } from '@/lib/supabase/types';
import { positionBadge, positionBadgeClass } from '@/lib/utils';

export function DraftCompleteModal({
  draft,
  team,
  picks,
  players,
  isCommissioner,
  onClose,
}: {
  draft: Draft;
  team: Team | null;
  picks: DraftPick[];
  players: Player[];
  isCommissioner: boolean;
  onClose: () => void;
}) {
  const [shareError, setShareError] = useState<string | null>(null);
  const playerById = new Map(players.map((p) => [p.id, p]));

  const myPicks = team
    ? picks.filter((p) => p.team_id === team.id).sort((a, b) => a.pick_number - b.pick_number)
    : [];
  const captain = team?.captain_player_id
    ? playerById.get(team.captain_player_id) ?? null
    : null;

  function buildShareText(): string {
    if (!team) return '';
    const lines = [
      `${team.name}${team.captain_name ? ` (${team.captain_name})` : ''} — ${draft.name} ${draft.year}`,
      '',
    ];
    if (captain) {
      lines.push(`${captain.position}  ${captain.first_name} ${captain.last_name}  (captain)`);
    }
    for (const pick of myPicks) {
      const p = playerById.get(pick.player_id);
      if (!p) continue;
      lines.push(`${p.position}  ${p.first_name} ${p.last_name}`);
    }
    return lines.join('\n');
  }

  async function share() {
    setShareError(null);
    const text = buildShareText();
    const shareData = {
      title: `${team?.name ?? 'Draft'} roster`,
      text,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(text);
      setShareError('Copied to clipboard (sharing not supported on this device).');
    } catch (e) {
      const err = e as { name?: string; message?: string };
      if (err.name === 'AbortError') return;
      setShareError(err.message ?? 'Could not share');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4 overflow-auto"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-t-lg sm:rounded-lg w-full max-w-md p-6 space-y-5 my-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="text-center space-y-1">
          <p className="text-emerald-400 text-xs uppercase tracking-widest">Draft complete</p>
          <h2 className="text-2xl font-bold">
            {team ? 'Your team is set!' : 'Draft is done!'}
          </h2>
        </header>

        {team && (
          <>
            <div className="text-center">
              <p className="font-semibold text-lg">{team.name}</p>
              {team.captain_name && (
                <p className="text-sm text-neutral-400">{team.captain_name}</p>
              )}
            </div>

            <ul className="bg-neutral-950 rounded border border-neutral-800 divide-y divide-neutral-800">
              {captain && (
                <li className="px-3 py-2 flex items-center gap-3">
                  <span className="text-xs font-semibold text-amber-400 w-4 text-center">C</span>
                  <span
                    className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                      captain.position,
                    )}`}
                  >
                    {positionBadge(captain.position)}
                  </span>
                  <span
                    className={`flex-1 ${
                      captain.gender === 'F' ? 'italic text-pink-300' : ''
                    }`}
                  >
                    {captain.first_name} {captain.last_name}
                  </span>
                </li>
              )}
              {myPicks.map((pick) => {
                const p = playerById.get(pick.player_id);
                if (!p) return null;
                return (
                  <li key={pick.id} className="px-3 py-2 flex items-center gap-3">
                    {captain && <span className="w-4" />}
                    <span
                      className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                        p.position,
                      )}`}
                    >
                      {positionBadge(p.position)}
                    </span>
                    <span
                      className={`flex-1 ${
                        p.gender === 'F' ? 'italic text-pink-300' : ''
                      }`}
                    >
                      {p.first_name} {p.last_name}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex gap-2">
              <button
                onClick={share}
                className="flex-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold py-3"
              >
                Share roster
              </button>
              <a
                href="/api/export?scope=team"
                className="flex-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-center font-semibold py-3"
              >
                Download CSV
              </a>
            </div>
            {shareError && (
              <p className="text-xs text-neutral-400 text-center">{shareError}</p>
            )}
          </>
        )}

        {isCommissioner && (
          <div className="pt-4 border-t border-neutral-800 space-y-2">
            <p className="text-xs uppercase tracking-widest text-neutral-500 text-center">
              Commissioner
            </p>
            <a
              href="/api/export?scope=all"
              className="block rounded-md bg-neutral-800 hover:bg-neutral-700 text-center font-semibold py-3 text-sm"
            >
              Download draft results (CSV)
            </a>
            <a
              href="/api/export?scope=teams"
              className="block rounded-md bg-neutral-800 hover:bg-neutral-700 text-center font-semibold py-3 text-sm"
            >
              Download teams (CSV, segmented)
            </a>
            <a
              href="/draft/results"
              target="_blank"
              rel="noopener"
              className="block rounded-md bg-neutral-800 hover:bg-neutral-700 text-center font-semibold py-3 text-sm"
            >
              Print results
            </a>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full text-sm text-neutral-400 hover:text-neutral-200 pt-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}
