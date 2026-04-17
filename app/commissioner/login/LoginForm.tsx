'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CommissionerLoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const res = await fetch('/api/auth/commissioner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: passcode.trim() }),
    });
    setPending(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Invalid passcode' }));
      setError(error || 'Invalid passcode');
      return;
    }
    router.push('/commissioner');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        autoFocus
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-4 py-3 text-lg text-center tracking-widest focus:outline-none focus:border-emerald-500"
        placeholder="Commissioner passcode"
      />
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={pending || !passcode.trim()}
        className="w-full rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-semibold py-3 transition-colors"
      >
        {pending ? 'Signing in…' : 'Continue'}
      </button>
    </form>
  );
}
