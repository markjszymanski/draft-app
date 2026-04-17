'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type TeamRow = { name: string; captain_name: string; passcode: string };

function emptyTeam(i: number): TeamRow {
  return { name: `Team ${i + 1}`, captain_name: '', passcode: '' };
}

function genPasscode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState('Ball Hockey Draft');
  const [year, setYear] = useState(new Date().getFullYear());
  const [salaryCap, setSalaryCap] = useState(10000);
  const [pickTimer, setPickTimer] = useState(120);
  const [draftMode, setDraftMode] = useState<'snake' | 'linear'>('snake');
  const [commissionerPasscode, setCommissionerPasscode] = useState(genPasscode());
  const [teams, setTeams] = useState<TeamRow[]>(
    Array.from({ length: 8 }, (_, i) => ({ ...emptyTeam(i), passcode: genPasscode() })),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateTeam(i: number, patch: Partial<TeamRow>) {
    setTeams((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function moveTeam(i: number, dir: -1 | 1) {
    setTeams((ts) => {
      const next = [...ts];
      const j = i + dir;
      if (j < 0 || j >= next.length) return ts;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addTeam() {
    setTeams((ts) => [...ts, { ...emptyTeam(ts.length), passcode: genPasscode() }]);
  }
  function removeTeam(i: number) {
    setTeams((ts) => ts.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (teams.some((t) => !t.name.trim() || !t.passcode.trim())) {
      setError('Every team needs a name and passcode.');
      return;
    }
    const passcodes = teams.map((t) => t.passcode.trim());
    if (new Set(passcodes).size !== passcodes.length) {
      setError('Team passcodes must be unique.');
      return;
    }
    setPending(true);
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        year,
        salary_cap: salaryCap,
        pick_timer_seconds: pickTimer,
        draft_mode: draftMode,
        commissioner_passcode: commissionerPasscode,
        teams: teams.map((t) => ({
          name: t.name.trim(),
          captain_name: t.captain_name.trim() || undefined,
          passcode: t.passcode.trim(),
        })),
        seed_players: { goalies: 0, defense: 0, forwards: 0 },
      }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Failed to create draft' }));
      setError(error);
      return;
    }
    // Land on Draft Settings so they can review/edit, then jump to Players from the nav.
    router.push('/commissioner/settings');
    router.refresh();
  }

  const inputCls =
    'rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 focus:outline-none focus:border-emerald-500';

  return (
    <form onSubmit={submit} className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold text-lg">Draft</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Name</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Year</span>
            <input
              type="number"
              className={inputCls}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Salary cap</span>
            <input
              type="number"
              className={inputCls}
              value={salaryCap}
              onChange={(e) => setSalaryCap(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Pick timer (seconds)</span>
            <select
              className={inputCls}
              value={pickTimer}
              onChange={(e) => setPickTimer(Number(e.target.value))}
            >
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={180}>3 minutes</option>
              <option value={240}>4 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Mode</span>
            <select
              className={inputCls}
              value={draftMode}
              onChange={(e) => setDraftMode(e.target.value as 'snake' | 'linear')}
            >
              <option value="snake">Snake</option>
              <option value="linear">Linear</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 col-span-2">
            <span className="text-xs text-neutral-400">Commissioner passcode (save this)</span>
            <input
              className={inputCls}
              value={commissionerPasscode}
              onChange={(e) => setCommissionerPasscode(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Teams (in draft order)</h2>
          <button
            type="button"
            onClick={addTeam}
            className="text-sm text-emerald-400 hover:text-emerald-300"
          >
            + Add team
          </button>
        </div>
        <div className="space-y-2">
          {teams.map((t, i) => (
            <div
              key={i}
              className="grid grid-cols-[2rem_1fr_1fr_8rem_auto] gap-2 items-center"
            >
              <span className="text-neutral-400 text-sm tabular-nums">#{i + 1}</span>
              <input
                className={inputCls}
                placeholder="Team name"
                value={t.name}
                onChange={(e) => updateTeam(i, { name: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Captain (optional)"
                value={t.captain_name}
                onChange={(e) => updateTeam(i, { captain_name: e.target.value })}
              />
              <input
                className={inputCls}
                placeholder="Passcode"
                value={t.passcode}
                onChange={(e) => updateTeam(i, { passcode: e.target.value })}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => moveTeam(i, -1)}
                  className="px-2 text-neutral-400 hover:text-neutral-100"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveTeam(i, 1)}
                  className="px-2 text-neutral-400 hover:text-neutral-100"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeTeam(i)}
                  className="px-2 text-rose-400 hover:text-rose-300"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-neutral-400">
        After creating the draft you'll review settings, then add players.
      </p>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-semibold py-3 transition-colors"
      >
        {pending ? 'Creating draft…' : 'Create draft'}
      </button>
    </form>
  );
}
