'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft, Team } from '@/lib/supabase/types';

type TeamRow = {
  id?: string;
  name: string;
  captain_name: string;
  passcode: string;
  draft_position: number;
};

function genPasscode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function SettingsForm({ draft, teams }: { draft: Draft; teams: Team[] }) {
  const router = useRouter();

  const [name, setName] = useState(draft.name);
  const [year, setYear] = useState(draft.year);
  const [salaryCap, setSalaryCap] = useState(draft.salary_cap);
  const [pickTimer, setPickTimer] = useState(draft.pick_timer_seconds);
  const [draftMode, setDraftMode] = useState<'snake' | 'linear'>(draft.draft_mode);
  const [commissionerPasscode, setCommissionerPasscode] = useState(draft.commissioner_passcode);

  const [teamRows, setTeamRows] = useState<TeamRow[]>(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      captain_name: t.captain_name ?? '',
      passcode: t.passcode,
      draft_position: t.draft_position,
    })),
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function updateTeam(i: number, patch: Partial<TeamRow>) {
    setTeamRows((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function moveTeam(i: number, dir: -1 | 1) {
    setTeamRows((ts) => {
      const next = [...ts];
      const j = i + dir;
      if (j < 0 || j >= next.length) return ts;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function addTeam() {
    setTeamRows((ts) => [
      ...ts,
      { name: `Team ${ts.length + 1}`, captain_name: '', passcode: genPasscode(), draft_position: ts.length + 1 },
    ]);
  }
  function removeTeam(i: number) {
    setTeamRows((ts) => ts.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError(null);
    setSavedAt(null);
    if (teamRows.length < 2) {
      setError('Need at least 2 teams.');
      return;
    }
    if (teamRows.some((t) => !t.name.trim() || !t.passcode.trim())) {
      setError('Every team needs a name and passcode.');
      return;
    }
    const passcodes = teamRows.map((t) => t.passcode.trim());
    if (new Set(passcodes).size !== passcodes.length) {
      setError('Team passcodes must be unique.');
      return;
    }

    setPending(true);
    const draftRes = await fetch('/api/draft/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        year,
        salary_cap: salaryCap,
        pick_timer_seconds: pickTimer,
        draft_mode: draftMode,
        commissioner_passcode: commissionerPasscode,
      }),
    });
    if (!draftRes.ok) {
      const json = await draftRes.json().catch(() => ({}));
      setError(json.error ?? 'Could not save draft settings.');
      setPending(false);
      return;
    }

    const teamsRes = await fetch('/api/teams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teams: teamRows.map((t, i) => ({
          id: t.id,
          name: t.name.trim(),
          captain_name: t.captain_name.trim() || null,
          passcode: t.passcode.trim(),
          draft_position: i + 1,
        })),
      }),
    });
    setPending(false);
    if (!teamsRes.ok) {
      const json = await teamsRes.json().catch(() => ({}));
      setError(json.error ?? 'Could not save teams.');
      return;
    }

    setSavedAt(new Date().toLocaleTimeString());
    router.refresh();
  }

  const inputCls =
    'rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 focus:outline-none focus:border-emerald-500';

  return (
    <div className="space-y-8">
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
          <label className="flex flex-col gap-1">
            <span className="text-xs text-neutral-400">Commissioner passcode</span>
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
          {teamRows.map((t, i) => (
            <div key={t.id ?? `new-${i}`} className="grid grid-cols-[2rem_1fr_1fr_8rem_auto] gap-2 items-center">
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

      {error && <p className="text-sm text-rose-400">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-semibold px-5 py-3"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Saved at {savedAt}</span>}
      </div>
    </div>
  );
}
