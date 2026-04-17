'use client';

import { useEffect, useRef, useState } from 'react';

function playExpiryChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Three short ascending beeps
    const notes = [
      { freq: 660, start: 0, dur: 0.18 },
      { freq: 880, start: 0.22, dur: 0.18 },
      { freq: 1320, start: 0.44, dur: 0.32 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = n.freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + n.start);
      gain.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + n.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n.start + n.dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + n.start);
      osc.stop(ctx.currentTime + n.start + n.dur);
    }
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Audio blocked — no-op
  }
}

export function PickTimer({
  startedAt,
  durationSeconds,
}: {
  startedAt: string | null;
  durationSeconds: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const playedForRef = useRef<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Fire chime once per pick when the timer hits zero
  useEffect(() => {
    if (!startedAt) return;
    const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
    const remaining = durationSeconds - elapsed;
    if (remaining <= 0 && playedForRef.current !== startedAt) {
      playedForRef.current = startedAt;
      playExpiryChime();
    }
  }, [now, startedAt, durationSeconds]);

  if (!startedAt) return null;
  const elapsed = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const remaining = Math.max(0, durationSeconds - elapsed);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const expired = remaining === 0;
  return (
    <div
      className={`tabular-nums text-2xl font-mono ${
        expired
          ? 'text-rose-400'
          : remaining <= 10
          ? 'text-rose-400'
          : remaining < 30
          ? 'text-amber-400'
          : 'text-neutral-200'
      }`}
    >
      {m}:{s.toString().padStart(2, '0')}
    </div>
  );
}
