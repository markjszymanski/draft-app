'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft } from '@/lib/supabase/types';

export function SettingsForm({ draft }: { draft: Draft }) {
  const router = useRouter();

  const [name, setName] = useState(draft.name);
  const [year, setYear] = useState(draft.year);
  const [salaryCap, setSalaryCap] = useState(draft.salary_cap);
  const [pickTimer, setPickTimer] = useState(draft.pick_timer_seconds);
  const [draftMode, setDraftMode] = useState<'snake' | 'linear'>(draft.draft_mode);
  const [commissionerPasscode, setCommissionerPasscode] = useState(draft.commissioner_passcode);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSavedAt(null);
    setPending(true);
    const res = await fetch('/api/draft/settings', {
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
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Could not save draft settings.');
      return;
    }
    setSavedAt(new Date().toLocaleTimeString());
    router.refresh();
  }

  const inputCls =
    'rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 focus:outline-none focus:border-emerald-500';

  return (
    <div className="space-y-6">
      <section className="space-y-3">
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

      <p className="text-sm text-neutral-400">
        Next: add the player pool on the Players tab, then set up teams + captains on the Teams tab.
      </p>
    </div>
  );
}
