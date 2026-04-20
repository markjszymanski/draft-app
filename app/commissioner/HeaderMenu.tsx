'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function HeaderMenu({ status }: { status: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function logOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  async function newDraft() {
    const inProgress = status === 'setup' || status === 'active' || status === 'paused';
    if (inProgress) {
      const ok = confirm(
        'A draft is currently in progress. Starting a new one will abandon this draft. Continue?',
      );
      if (!ok) return;
      const res = await fetch('/api/draft/abandon', { method: 'POST' });
      if (!res.ok) {
        alert('Could not abandon current draft.');
        return;
      }
    }
    const res = await fetch('/api/draft/new', { method: 'POST' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Could not start a new draft.');
      return;
    }
    router.push('/commissioner/settings');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded text-neutral-400 hover:text-neutral-100 p-1"
        aria-label="Settings"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-md border border-neutral-800 bg-neutral-900 shadow-lg z-30 py-1 text-sm">
          {status === 'setup' && (
            <>
              <Link
                href="/commissioner/settings"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 hover:bg-neutral-800"
              >
                Draft settings
              </Link>
              <Link
                href="/commissioner/players"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 hover:bg-neutral-800"
              >
                Players
              </Link>
              <Link
                href="/commissioner/teams"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 hover:bg-neutral-800"
              >
                Teams
              </Link>
            </>
          )}
          <button
            onClick={() => {
              setOpen(false);
              newDraft();
            }}
            className="block w-full text-left px-3 py-2 hover:bg-neutral-800"
          >
            Start a new draft
          </button>
          <div className="border-t border-neutral-800 my-1" />
          <button
            onClick={() => {
              setOpen(false);
              logOut();
            }}
            className="block w-full text-left px-3 py-2 hover:bg-neutral-800 text-rose-300"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
