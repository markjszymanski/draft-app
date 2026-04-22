'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDraftState } from '@/hooks/useDraftState';
import { useStars } from '@/hooks/useStars';
import { teamForPick, teamCapUsed, rosterCounts } from '@/lib/draft-logic';
import { PlayerBoard } from '@/components/draft/PlayerBoard';
import { MyTeamPanel } from '@/components/draft/MyTeamPanel';
import { AllTeamsPanel } from '@/components/draft/AllTeamsPanel';
import { DraftOrderPanel } from '@/components/draft/DraftOrderPanel';
import { ConfirmPickModal } from '@/components/draft/ConfirmPickModal';
import { DraftCompleteModal } from '@/components/draft/DraftCompleteModal';
import { ResolveClaimModal } from '@/components/draft/ResolveClaimModal';
import { PickTimer } from '@/components/draft/PickTimer';
import type { Player } from '@/lib/supabase/types';
import { fmtPoints } from '@/lib/utils';

type Tab = 'board' | 'team' | 'teams' | 'order';

export function DraftView({
  draftId,
  viewerTeamId,
  isCommissioner,
}: {
  draftId: string;
  viewerTeamId: string | null;
  isCommissioner: boolean;
}) {
  const state = useDraftState(draftId);
  // Stars are per-team. Re-fetch when the pick count changes so de-starred
  // (drafted) players drop out without a manual refresh.
  const { starred, toggle: toggleStar } = useStars(viewerTeamId ? state.picks.length : 'none');
  const [tab, setTab] = useState<Tab>('board');
  const [pendingPlayer, setPendingPlayer] = useState<Player | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [completeModalSeen, setCompleteModalSeen] = useState(false);

  const { draft, teams, players, picks, loading } = state;

  const onClock = useMemo(() => {
    if (!draft || teams.length === 0 || draft.status !== 'active') return null;
    return teamForPick(draft.current_pick_number, teams, draft.draft_mode);
  }, [draft, teams]);

  const onDeck = useMemo(() => {
    if (!draft || teams.length === 0 || draft.status !== 'active') return null;
    const totalPicks = teams.length * draft.roster_size;
    if (draft.current_pick_number + 1 > totalPicks) return null;
    return teamForPick(draft.current_pick_number + 1, teams, draft.draft_mode);
  }, [draft, teams]);

  const onClockTeam = teams.find((t) => t.id === onClock?.teamId) ?? null;
  const onDeckTeam = teams.find((t) => t.id === onDeck?.teamId) ?? null;
  const isMyTurn = !!viewerTeamId && onClock?.teamId === viewerTeamId;
  const amOnDeck = !!viewerTeamId && onDeck?.teamId === viewerTeamId;

  // Only the commissioner decides whether a pending claim is used or skipped;
  // the on-clock team is blocked from picking until that happens. The skip flag
  // lives on the draft row so realtime broadcasts it to every client.
  const onClockClaims =
    onClock && draft?.status === 'active'
      ? players.filter(
          (p) => p.reserved_for_team_id === onClock.teamId && !p.drafted_by_team_id,
        )
      : [];
  const claimSkippedThisPick =
    !!draft && draft.claim_skipped_for_pick === draft.current_pick_number;
  const onHold =
    onClockClaims.length > 0 && !claimSkippedThisPick;
  const canPick = (isCommissioner || isMyTurn) && !onHold;

  // Picks remaining for the on-clock team (including the current one).
  // Used so the resolve modal knows whether "skip" is allowed.
  const picksRemainingForOnClock = (() => {
    if (!onClock || !draft) return 0;
    const totalPicks = teams.length * draft.roster_size;
    let remaining = 0;
    for (let n = draft.current_pick_number; n <= totalPicks; n++) {
      const idx = (n - 1) % teams.length;
      const round = Math.floor((n - 1) / teams.length) + 1;
      const sortedTeams = [...teams].sort((a, b) => a.draft_position - b.draft_position);
      const reversed: boolean = draft.draft_mode === 'snake' && round % 2 === 0;
      const slot = reversed ? teams.length - 1 - idx : idx;
      if (sortedTeams[slot]?.id === onClock.teamId) remaining++;
    }
    return remaining;
  })();

  // Auto-open the completion modal once when the draft transitions to complete.
  useEffect(() => {
    if (draft?.status === 'complete' && !completeModalSeen) {
      setCompleteModalOpen(true);
      setCompleteModalSeen(true);
    }
  }, [draft?.status, completeModalSeen]);

  // Most recent completed pick — shown in the header so everyone can see who
  // just went. Picks are kept sorted by pick_number; undo only removes the tail.
  const lastPick = picks.length > 0 ? picks[picks.length - 1] : null;
  const lastPickTeam = lastPick ? teams.find((t) => t.id === lastPick.team_id) ?? null : null;
  const lastPickPlayer = lastPick ? players.find((p) => p.id === lastPick.player_id) ?? null : null;

  // Commissioner has no team of their own — focus on the team currently on the clock.
  // When the draft is complete, fall back to the team that made the very last pick.
  const focusTeamId = isCommissioner
    ? onClock?.teamId ?? lastPick?.team_id ?? null
    : viewerTeamId;
  const focusTeam = teams.find((t) => t.id === focusTeamId) ?? null;

  if (loading || !draft) {
    return <div className="p-6 text-neutral-400">Loading…</div>;
  }

  async function submitPick(player: Player, ack: boolean) {
    setPickError(null);
    const res = await fetch('/api/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.id, acknowledgeCapWarning: ack }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (json?.error === 'cap_warning') {
        // Modal will surface the warning via its own state
        setPickError(json.message ?? 'Cap warning');
        return { capWarning: json };
      }
      setPickError(json?.error ?? 'Pick failed');
      return { error: json?.error };
    }
    setPendingPlayer(null);
    setPickError(null);
    return { ok: true };
  }

  async function fulfillClaim(playerId: string) {
    const res = await fetch('/api/pick/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Could not fulfill claim.');
    }
  }

  async function skipClaim() {
    const res = await fetch('/api/pick/claim/skip', { method: 'POST' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Could not skip claim.');
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {draft.status === 'active' && onClockTeam && (
        <>
          <div
            className={`px-4 py-3 border-b border-neutral-800 flex items-center justify-between ${
              onHold
                ? 'bg-violet-500/10'
                : isMyTurn
                ? 'bg-emerald-500/10'
                : 'bg-neutral-900'
            }`}
          >
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-400">
                Pick #{draft.current_pick_number} · Round {onClock?.round}
              </p>
              <p className="font-semibold">
                {onHold ? 'On hold: ' : 'On the clock: '}
                <span
                  className={
                    onHold ? 'text-violet-300' : isMyTurn ? 'text-emerald-400' : ''
                  }
                >
                  {onClockTeam.name}
                  {onClockTeam.captain_name && (
                    <span className="text-neutral-400 font-normal"> ({onClockTeam.captain_name})</span>
                  )}
                </span>
                {onHold && (
                  <span className="ml-2 text-violet-300 font-bold uppercase tracking-wide">
                    — claims to resolve
                  </span>
                )}
                {!onHold && isMyTurn && (
                  <span className="ml-2 text-emerald-400 font-bold uppercase tracking-wide">
                    — you're up, make your pick
                  </span>
                )}
              </p>
            </div>
            <PickTimer
              startedAt={draft.current_pick_started_at}
              durationSeconds={draft.pick_timer_seconds}
            />
          </div>
          {onDeckTeam && (
            <div
              className={`px-4 py-2 border-b border-neutral-800 text-sm ${
                amOnDeck ? 'bg-amber-500/15 text-amber-200' : 'bg-neutral-950 text-neutral-400'
              }`}
            >
              <span className="text-xs uppercase tracking-wider">Up next:</span>{' '}
              <span className={amOnDeck ? 'font-semibold text-amber-200' : 'text-neutral-200'}>
                {onDeckTeam.name}
                {onDeckTeam.captain_name && (
                  <span className="text-neutral-500"> ({onDeckTeam.captain_name})</span>
                )}
              </span>
              {amOnDeck && (
                <span className="ml-2 font-bold uppercase tracking-wide">— get ready</span>
              )}
            </div>
          )}
          {lastPick && lastPickTeam && lastPickPlayer && (
            <div className="px-4 py-2 border-b border-neutral-800 text-sm bg-neutral-950 text-neutral-400">
              <span className="text-xs uppercase tracking-wider">Last pick:</span>{' '}
              <span className="text-neutral-200">{lastPickTeam.name}</span>
              <span className="text-neutral-500"> — </span>
              <span
                className={
                  lastPickPlayer.gender === 'F' ? 'italic text-pink-300' : 'text-neutral-100'
                }
              >
                {lastPickPlayer.first_name} {lastPickPlayer.last_name}
              </span>
              <span className="text-neutral-500"> ({fmtPoints(lastPickPlayer.point_value)} pts)</span>
            </div>
          )}
        </>
      )}

      {draft.status === 'setup' && (
        <div className="px-4 py-3 border-b border-neutral-800 bg-neutral-900 text-neutral-400 text-sm">
          Waiting for the commissioner to start the draft…
        </div>
      )}

      {draft.status === 'complete' && (
        <div className="px-4 py-3 border-b border-neutral-800 bg-emerald-500/10 text-emerald-300 text-sm font-semibold flex items-center justify-between">
          <span>Draft complete!</span>
          <button
            onClick={() => setCompleteModalOpen(true)}
            className="text-xs rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold px-3 py-1.5"
          >
            View results
          </button>
        </div>
      )}

      <nav className="flex border-b border-neutral-800 text-xs sm:text-sm">
        {(['board', 'team', 'teams', 'order'] as Tab[]).map((t) => {
          const availableCount = players.filter(
            (p) => !p.drafted_by_team_id && !p.reserved_for_team_id,
          ).length;
          const short =
            t === 'board'
              ? `Board (${availableCount})`
              : t === 'team'
              ? isCommissioner
                ? 'Current'
                : 'My Team'
              : t === 'teams'
              ? 'All Teams'
              : 'Order';
          const long =
            t === 'board'
              ? `Available Players (${availableCount})`
              : t === 'team'
              ? isCommissioner
                ? 'Current Team'
                : 'My Team'
              : t === 'teams'
              ? 'All Teams'
              : 'Draft Order';
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 transition-colors ${
                tab === t
                  ? 'bg-neutral-900 text-neutral-100 border-b-2 border-emerald-500'
                  : 'text-neutral-400 hover:text-neutral-100'
              }`}
            >
              <span className="sm:hidden">{short}</span>
              <span className="hidden sm:inline">{long}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 overflow-auto">
        {tab === 'board' && (
          <PlayerBoard
            players={players}
            teams={teams}
            picks={picks}
            canPick={canPick && draft.status === 'active'}
            onPick={(p) => setPendingPlayer(p)}
            starred={starred}
            onToggleStar={viewerTeamId ? toggleStar : undefined}
            viewerTeamId={viewerTeamId}
            pickButtonLabel={
              isCommissioner && onClockTeam ? `Pick for ${onClockTeam.name}` : 'Pick'
            }
          />
        )}
        {tab === 'team' && (
          <MyTeamPanel
            team={focusTeam}
            players={players}
            picks={picks}
            cap={draft.salary_cap}
            teamCount={teams.length}
          />
        )}
        {tab === 'teams' && (
          <AllTeamsPanel
            teams={teams}
            players={players}
            picks={picks}
            cap={draft.salary_cap}
            rosterSize={draft.roster_size}
            highlightTeamId={onClock?.teamId ?? null}
          />
        )}
        {tab === 'order' && (
          <DraftOrderPanel
            draft={draft}
            teams={teams}
            picks={picks}
            players={players}
          />
        )}
      </div>

      {pendingPlayer && (
        <ConfirmPickModal
          player={pendingPlayer}
          team={focusTeam}
          cap={draft.salary_cap}
          currentSpend={
            focusTeam ? teamCapUsed(focusTeam.id, picks, players) : 0
          }
          counts={focusTeam ? rosterCounts(focusTeam.id, picks, players) : { F: 0, D: 0, G: 0, FD: 0, M: 0, W: 0, total: 0 }}
          rosterSize={draft.roster_size}
          allPlayers={players}
          allTeams={teams}
          error={pickError}
          onCancel={() => {
            setPendingPlayer(null);
            setPickError(null);
          }}
          onConfirm={(ack) => submitPick(pendingPlayer, ack)}
        />
      )}

      {onHold && onClockTeam && isCommissioner && (
        <ResolveClaimModal
          team={onClockTeam}
          claimedPlayers={onClockClaims}
          picksRemainingForTeam={picksRemainingForOnClock}
          onClose={() => {}}
          onPickClaim={fulfillClaim}
          onLetPick={skipClaim}
        />
      )}

      {completeModalOpen && draft.status === 'complete' && (
        <DraftCompleteModal
          draft={draft}
          team={viewerTeamId ? teams.find((t) => t.id === viewerTeamId) ?? null : null}
          picks={picks}
          players={players}
          isCommissioner={isCommissioner}
          onClose={() => setCompleteModalOpen(false)}
        />
      )}
    </div>
  );
}
