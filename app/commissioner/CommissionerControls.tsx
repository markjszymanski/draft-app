'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CommissionerControls({
  status,
  playerCount,
}: {
  status: string;
  playerCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (!confirm('Start the draft? Pick #1 will be on the clock.')) return;
    setBusy(true);
    await fetch('/api/draft/start', { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  async function undo() {
    if (!confirm('Undo the last pick?')) return;
    setBusy(true);
    await fetch('/api/undo', { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  async function forceComplete() {
    if (!confirm('Mark the draft complete? This stops the clock and ends the draft.')) return;
    setBusy(true);
    await fetch('/api/draft/complete', { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  async function simulate(mode: 'one' | 'all') {
    if (mode === 'all' && !confirm('Auto-pick the rest of the draft?')) return;
    setBusy(true);
    await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="border-b border-neutral-800 px-4 py-2 flex gap-2 items-center bg-neutral-900/50">
      {status === 'setup' && (
        <button
          onClick={start}
          disabled={busy || playerCount === 0}
          title={playerCount === 0 ? 'Add players before starting.' : undefined}
          className="rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start draft
        </button>
      )}
      {status === 'active' && (
        <>
          <button
            onClick={undo}
            disabled={busy}
            className="rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
          >
            Undo last pick
          </button>
          <span className="w-px h-5 bg-neutral-800" />
          <button
            onClick={() => simulate('one')}
            disabled={busy}
            className="rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
            title="Auto-pick the next slot"
          >
            Sim 1 pick
          </button>
          <button
            onClick={() => simulate('all')}
            disabled={busy}
            className="rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
            title="Auto-pick the rest of the draft"
          >
            Sim to end
          </button>
          <span className="w-px h-5 bg-neutral-800" />
          <button
            onClick={forceComplete}
            disabled={busy}
            className="rounded bg-rose-500/80 hover:bg-rose-500 text-neutral-950 text-sm font-semibold px-3 py-1.5 disabled:opacity-50"
            title="Force the draft to complete (use if stuck)"
          >
            End draft
          </button>
        </>
      )}
      <span
        className={`text-xs ml-2 ${
          status === 'setup' && playerCount === 0 ? 'text-amber-300' : 'text-neutral-500'
        }`}
      >
        {status === 'active'
          ? 'Tap a player on the board to pick for the team on the clock.'
          : status === 'complete'
          ? 'Draft complete.'
          : playerCount === 0
          ? 'No players yet — add some via the gear menu → Manage players.'
          : `Ready to start (${playerCount} players).`}
      </span>
    </div>
  );
}
