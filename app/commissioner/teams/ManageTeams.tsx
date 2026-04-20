'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Player, Team } from '@/lib/supabase/types';
import { fmtPoints } from '@/lib/utils';

type TeamRow = {
  id?: string;
  name: string;
  captain_player_id: string | null;
  passcode: string;
  draft_position: number;
};

function genPasscode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

const inputCls =
  'rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 focus:outline-none focus:border-emerald-500';

export function ManageTeams({
  initialTeams,
  players,
}: {
  initialTeams: Team[];
  players: Player[];
}) {
  const router = useRouter();
  const [teamRows, setTeamRows] = useState<TeamRow[]>(
    initialTeams.length > 0
      ? initialTeams.map((t) => ({
          id: t.id,
          name: t.name,
          captain_player_id: t.captain_player_id,
          passcode: t.passcode,
          draft_position: t.draft_position,
        }))
      : Array.from({ length: 8 }, (_, i) => ({
          name: `Team ${i + 1}`,
          captain_player_id: null,
          passcode: genPasscode(),
          draft_position: i + 1,
        })),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

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
      {
        name: `Team ${ts.length + 1}`,
        captain_player_id: null,
        passcode: genPasscode(),
        draft_position: ts.length + 1,
      },
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
    const captainIds = teamRows
      .map((t) => t.captain_player_id)
      .filter((id): id is string => !!id);
    if (new Set(captainIds).size !== captainIds.length) {
      setError('Each player can only be captain of one team.');
      return;
    }

    setPending(true);
    const res = await fetch('/api/teams', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        teams: teamRows.map((t, i) => ({
          id: t.id,
          name: t.name.trim(),
          captain_player_id: t.captain_player_id,
          passcode: t.passcode.trim(),
          draft_position: i + 1,
        })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? 'Could not save teams.');
      return;
    }
    setSavedAt(new Date().toLocaleTimeString());
    router.refresh();
  }

  // Which captain ids are already claimed (by a DIFFERENT team)?
  function claimedBy(thisIdx: number): Set<string> {
    const s = new Set<string>();
    teamRows.forEach((t, i) => {
      if (i !== thisIdx && t.captain_player_id) s.add(t.captain_player_id);
    });
    return s;
  }

  if (players.length === 0) {
    return (
      <div className="rounded border border-neutral-800 bg-neutral-900/50 p-6 text-sm text-neutral-400 space-y-2">
        <p>No players in the pool yet.</p>
        <p>
          Add players first from the{' '}
          <a href="/commissioner/players" className="text-emerald-400 hover:underline">
            Players tab
          </a>
          . Captains are selected from the player pool.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <p className="text-xs text-neutral-500">
          Each team&apos;s captain must be one of the players in the pool. The captain is automatically
          assigned to their team before the draft starts and counts toward the team&apos;s cap.
        </p>
        <div className="space-y-2">
          {teamRows.map((t, i) => (
            <div
              key={t.id ?? `new-${i}`}
              className="grid grid-cols-[2rem_1fr_1.5fr_7rem_auto] gap-2 items-center"
            >
              <span className="text-neutral-400 text-sm tabular-nums">#{i + 1}</span>
              <input
                className={inputCls}
                placeholder="Team name"
                value={t.name}
                onChange={(e) => updateTeam(i, { name: e.target.value })}
              />
              <CaptainPicker
                selectedId={t.captain_player_id}
                players={players}
                excludedIds={claimedBy(i)}
                onChange={(id) => updateTeam(i, { captain_player_id: id })}
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
          {pending ? 'Saving…' : 'Save teams'}
        </button>
        {savedAt && <span className="text-xs text-emerald-400">Saved at {savedAt}</span>}
      </div>
    </div>
  );
}

function CaptainPicker({
  selectedId,
  players,
  excludedIds,
  onChange,
}: {
  selectedId: string | null;
  players: Player[];
  excludedIds: Set<string>;
  onChange: (id: string | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = selectedId ? players.find((p) => p.id === selectedId) : null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return players
      .filter((p) => !excludedIds.has(p.id))
      .filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [players, query, excludedIds]);

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 flex items-center gap-2">
          <span className="text-[10px] font-bold bg-neutral-800 text-neutral-200 rounded px-1">
            {selected.position === 'FD' ? 'F/D' : selected.position}
          </span>
          <span
            className={`flex-1 truncate ${
              selected.gender === 'F' ? 'italic text-pink-300' : ''
            }`}
          >
            {selected.first_name} {selected.last_name}
          </span>
          <span className="tabular-nums text-xs text-neutral-400">
            {fmtPoints(selected.point_value)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery('');
          }}
          className="text-xs text-rose-400 hover:text-rose-300"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        className={`${inputCls} w-full`}
        placeholder="Captain — type to search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-10 top-full mt-1 left-0 right-0 rounded-md border border-neutral-800 bg-neutral-900 shadow-lg max-h-60 overflow-auto">
          {matches.map((p) => (
            <li
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setQuery('');
                setOpen(false);
              }}
              className="px-3 py-2 hover:bg-neutral-800 cursor-pointer flex items-center gap-2 text-sm"
            >
              <span className="text-[10px] font-bold bg-neutral-800 text-neutral-200 rounded px-1">
                {p.position === 'FD' ? 'F/D' : p.position}
              </span>
              <span
                className={`flex-1 ${p.gender === 'F' ? 'italic text-pink-300' : ''}`}
              >
                {p.first_name} {p.last_name}
              </span>
              <span className="tabular-nums text-xs text-neutral-400">
                {fmtPoints(p.point_value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
