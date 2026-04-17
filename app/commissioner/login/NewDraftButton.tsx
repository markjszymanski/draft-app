'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function NewDraftButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setBusy(true);
    const res = await fetch('/api/draft/new', { method: 'POST' });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Could not start a new draft.');
      return;
    }
    router.push('/commissioner/setup');
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        onClick={start}
        disabled={busy}
        className="w-full rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 font-semibold py-3 disabled:opacity-50"
      >
        {busy ? 'Working…' : 'Start a new draft'}
      </button>
      {error && <p className="text-sm text-rose-400 text-center">{error}</p>}
    </div>
  );
}
