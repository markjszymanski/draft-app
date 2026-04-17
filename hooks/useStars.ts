'use client';

import { useCallback, useEffect, useState } from 'react';

// Hook for the viewer's starred players. Returns a Set of player IDs plus
// a toggle helper. Re-fetches on `refreshKey` change so external events
// (e.g. a pick that removed a starred player from everyone's stars) propagate.
export function useStars(refreshKey?: unknown) {
  const [starred, setStarred] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const res = await fetch('/api/stars', { cache: 'no-store' });
    if (!res.ok) return;
    const json = (await res.json()) as { playerIds: string[] };
    setStarred(new Set(json.playerIds));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const toggle = useCallback(
    async (playerId: string) => {
      const isStarred = starred.has(playerId);
      // Optimistic update
      setStarred((prev) => {
        const next = new Set(prev);
        if (isStarred) next.delete(playerId);
        else next.add(playerId);
        return next;
      });
      const res = isStarred
        ? await fetch(`/api/stars?playerId=${playerId}`, { method: 'DELETE' })
        : await fetch('/api/stars', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId }),
          });
      if (!res.ok) refresh();
    },
    [starred, refresh],
  );

  return { starred, toggle, refresh };
}
