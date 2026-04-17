'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Draft, DraftPick, Package, Player, Team } from '@/lib/supabase/types';

export type DraftState = {
  draft: Draft | null;
  teams: Team[];
  players: Player[];
  picks: DraftPick[];
  packages: Package[];
  loading: boolean;
};

export function useDraftState(draftId: string): DraftState {
  const [state, setState] = useState<DraftState>({
    draft: null,
    teams: [],
    players: [],
    picks: [],
    packages: [],
    loading: true,
  });

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;

    async function load() {
      const [draftRes, teamsRes, playersRes, picksRes, packagesRes] = await Promise.all([
        sb.from('drafts').select('*').eq('id', draftId).single(),
        sb.from('teams').select('*').eq('draft_id', draftId).order('draft_position'),
        sb.from('players').select('*').eq('draft_id', draftId),
        sb.from('picks').select('*').eq('draft_id', draftId).order('pick_number'),
        sb.from('packages').select('*').eq('draft_id', draftId),
      ]);
      if (cancelled) return;
      setState({
        draft: (draftRes.data as Draft | null) ?? null,
        teams: (teamsRes.data as Team[] | null) ?? [],
        players: (playersRes.data as Player[] | null) ?? [],
        picks: (picksRes.data as DraftPick[] | null) ?? [],
        packages: (packagesRes.data as Package[] | null) ?? [],
        loading: false,
      });
    }
    load();

    const channel = sb
      .channel(`draft:${draftId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'drafts', filter: `id=eq.${draftId}` },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setState((s) => ({ ...s, draft: payload.new as Draft }));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'picks', filter: `draft_id=eq.${draftId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'INSERT') {
              return { ...s, picks: [...s.picks, payload.new as DraftPick] };
            }
            if (payload.eventType === 'DELETE') {
              return { ...s, picks: s.picks.filter((p) => p.id !== (payload.old as DraftPick).id) };
            }
            return s;
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: `draft_id=eq.${draftId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'UPDATE') {
              return {
                ...s,
                players: s.players.map((p) =>
                  p.id === (payload.new as Player).id ? (payload.new as Player) : p,
                ),
              };
            }
            return s;
          });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'packages', filter: `draft_id=eq.${draftId}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === 'INSERT') {
              return { ...s, packages: [...s.packages, payload.new as Package] };
            }
            if (payload.eventType === 'DELETE') {
              return { ...s, packages: s.packages.filter((p) => p.id !== (payload.old as Package).id) };
            }
            if (payload.eventType === 'UPDATE') {
              return {
                ...s,
                packages: s.packages.map((p) =>
                  p.id === (payload.new as Package).id ? (payload.new as Package) : p,
                ),
              };
            }
            return s;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [draftId]);

  return state;
}
