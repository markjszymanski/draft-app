'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function JoinForm({ draftId }: { draftId: string }) {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch('/api/auth/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draftId, passcode: passcode.trim() }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Invalid passcode' }));
      setError(error || 'Invalid passcode');
      return;
    }
    router.push('/draft');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="text-sm text-neutral-400">Team passcode</span>
        <input
          autoFocus
          inputMode="text"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-4 py-3 text-lg text-center tracking-widest focus:outline-none focus:border-emerald-500"
          placeholder="Enter passcode"
        />
      </label>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={pending || !passcode.trim()}
        className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-semibold py-3 transition-colors"
      >
        {pending ? 'Joining…' : 'Join draft'}
      </button>
    </form>
  );
}
