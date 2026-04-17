'use client';

import { useMemo, useState } from 'react';
import type { Player, Team, DraftPick, Position, Gender } from '@/lib/supabase/types';
import { fmtPoints, positionBadge, positionBadgeClass } from '@/lib/utils';

export function PlayerBoard({
  players,
  teams,
  canPick,
  onPick,
  starred,
  onToggleStar,
  viewerTeamId,
  pickButtonLabel = 'Pick',
}: {
  players: Player[];
  teams: Team[];
  picks: DraftPick[];
  canPick: boolean;
  onPick: (p: Player) => void;
  starred?: Set<string>;
  onToggleStar?: (playerId: string) => void;
  viewerTeamId?: string | null;
  pickButtonLabel?: string;
}) {
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | Gender>('ALL');
  const [hideDrafted, setHideDrafted] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useState<'points' | 'first' | 'last'>('points');
  const [search, setSearch] = useState('');

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const filtered = useMemo(() => {
    let rows = players;
    // Claimed (reserved-but-not-drafted) players never appear on the available board —
    // they belong to the claiming team and only the commissioner can convert a claim
    // into a real pick.
    rows = rows.filter((p) => !p.reserved_for_team_id || p.drafted_by_team_id);
    if (filter !== 'ALL') rows = rows.filter((p) => p.position === filter);
    if (genderFilter !== 'ALL') rows = rows.filter((p) => p.gender === genderFilter);
    if (hideDrafted) rows = rows.filter((p) => !p.drafted_by_team_id);
    if (starredOnly && starred) rows = rows.filter((p) => starred.has(p.id));
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) || p.last_name.toLowerCase().includes(q),
      );
    }
    rows = [...rows].sort((a, b) => {
      if (sort === 'points') return b.point_value - a.point_value;
      if (sort === 'first') return a.first_name.localeCompare(b.first_name);
      return a.last_name.localeCompare(b.last_name);
    });
    return rows;
  }, [players, filter, genderFilter, hideDrafted, starredOnly, starred, sort, search]);

  // Per-chip counts: each chip shows what its count would be if it were
  // the selected option, with all OTHER filters still applied. Lets you see
  // "Forwards (12)" without committing to the click.
  const counts = useMemo(() => {
    const notClaimed = (p: Player) => !p.reserved_for_team_id || p.drafted_by_team_id;
    const matchesNonPosition = (p: Player) =>
      notClaimed(p) &&
      (genderFilter === 'ALL' || p.gender === genderFilter) &&
      (!hideDrafted || !p.drafted_by_team_id) &&
      (!starredOnly || !starred || starred.has(p.id)) &&
      (!search.trim() ||
        p.first_name.toLowerCase().includes(search.trim().toLowerCase()) ||
        p.last_name.toLowerCase().includes(search.trim().toLowerCase()));
    const matchesNonGender = (p: Player) =>
      notClaimed(p) &&
      (filter === 'ALL' || p.position === filter) &&
      (!hideDrafted || !p.drafted_by_team_id) &&
      (!starredOnly || !starred || starred.has(p.id)) &&
      (!search.trim() ||
        p.first_name.toLowerCase().includes(search.trim().toLowerCase()) ||
        p.last_name.toLowerCase().includes(search.trim().toLowerCase()));

    const position = { ALL: 0, F: 0, D: 0, G: 0, FD: 0 };
    const gender = { ALL: 0, M: 0, F: 0 };
    let starredCount = 0;

    for (const p of players) {
      if (matchesNonPosition(p)) {
        position.ALL++;
        position[p.position]++;
      }
      if (matchesNonGender(p)) {
        gender.ALL++;
        gender[p.gender]++;
      }
      if (starred?.has(p.id)) starredCount++;
    }

    return { position, gender, starred: starredCount };
  }, [players, filter, genderFilter, hideDrafted, starredOnly, starred, search]);

  const totalAvailable = useMemo(
    () => players.filter((p) => !p.drafted_by_team_id && !p.reserved_for_team_id).length,
    [players],
  );

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 bg-neutral-950 border-b border-neutral-800 px-3 py-2 space-y-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players…"
          className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
        />
        <div className="flex gap-2 items-center text-xs flex-wrap">
          {(['ALL', 'F', 'D', 'FD', 'G'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded ${
                filter === f
                  ? 'bg-emerald-500 text-neutral-950 font-semibold'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              {f === 'ALL'
                ? 'All'
                : f === 'F'
                ? 'Forwards'
                : f === 'D'
                ? 'Defensemen'
                : f === 'FD'
                ? 'F/D'
                : 'Goalies'}{' '}
              <span className="opacity-70">({counts.position[f]})</span>
            </button>
          ))}
          <span className="w-px h-5 bg-neutral-800 mx-1" />
          {(['ALL', 'M', 'F'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-2 py-1 rounded ${
                genderFilter === g
                  ? g === 'F'
                    ? 'bg-pink-500 text-neutral-950 font-semibold'
                    : g === 'M'
                    ? 'bg-sky-500 text-neutral-950 font-semibold'
                    : 'bg-emerald-500 text-neutral-950 font-semibold'
                  : 'bg-neutral-900 text-neutral-400'
              }`}
            >
              {g === 'ALL' ? 'M+W' : g === 'M' ? 'Men' : 'Women'}{' '}
              <span className="opacity-70">({counts.gender[g]})</span>
            </button>
          ))}
          {starred && (
            <>
              <span className="w-px h-5 bg-neutral-800 mx-1" />
              <button
                onClick={() => setStarredOnly((v) => !v)}
                className={`px-2 py-1 rounded ${
                  starredOnly
                    ? 'bg-yellow-400 text-neutral-950 font-semibold'
                    : 'bg-neutral-900 text-neutral-400'
                }`}
                title="Show only starred players"
              >
                ★ Starred ({starred.size})
              </button>
            </>
          )}
          <span className="ml-auto flex gap-2 items-center">
            <label className="flex items-center gap-1 text-neutral-400">
              <input
                type="checkbox"
                checked={hideDrafted}
                onChange={(e) => setHideDrafted(e.target.checked)}
              />
              Hide drafted
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'points' | 'first' | 'last')}
              className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1"
            >
              <option value="points">Sort: points</option>
              <option value="first">Sort: first name</option>
              <option value="last">Sort: last name</option>
            </select>
          </span>
        </div>
        <p className="text-xs text-neutral-500">
          Showing {filtered.length} of {totalAvailable} available
          {hideDrafted ? '' : ` · ${players.length} total`}
        </p>
      </div>

      <ul className="divide-y divide-neutral-900">
        {filtered.map((p) => {
          const drafted = !!p.drafted_by_team_id;
          const ownerTeam = drafted ? teamById.get(p.drafted_by_team_id!) : null;
          const isStarred = !!starred?.has(p.id);
          const reservingTeam = p.reserved_for_team_id
            ? teamById.get(p.reserved_for_team_id) ?? null
            : null;
          const reservedForMe = !!viewerTeamId && p.reserved_for_team_id === viewerTeamId;
          const packageMates = p.package_id
            ? players.filter((other) => other.id !== p.id && other.package_id === p.package_id)
            : [];
          return (
            <li
              key={p.id}
              className={`px-3 py-2 flex items-center gap-3 ${drafted ? 'opacity-50' : ''} ${
                reservedForMe && !drafted ? 'bg-emerald-500/5' : ''
              }`}
            >
              {onToggleStar && (
                <button
                  onClick={() => onToggleStar(p.id)}
                  disabled={drafted}
                  className={`text-lg leading-none transition-colors ${
                    isStarred
                      ? 'text-yellow-400 hover:text-yellow-300'
                      : 'text-neutral-700 hover:text-neutral-400'
                  } disabled:opacity-30`}
                  aria-label={isStarred ? 'Unstar' : 'Star'}
                  title={isStarred ? 'Unstar' : 'Star'}
                >
                  {isStarred ? '★' : '☆'}
                </button>
              )}
              <span
                className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                  p.position,
                )}`}
              >
                {positionBadge(p.position)}
              </span>
              <div className="flex-1 min-w-0">
                <p className="truncate flex items-center gap-1.5 flex-wrap">
                  <span className={p.gender === 'F' ? 'italic text-pink-300' : ''}>
                    {p.first_name} {p.last_name}
                  </span>
                  {packageMates.length > 0 && (
                    <span
                      className="text-xs text-neutral-300 bg-neutral-800 rounded px-1.5 py-0.5 shrink-0"
                      title={`Package — drafting reserves: ${packageMates
                        .map((m) => `${m.first_name} ${m.last_name}`)
                        .join(', ')}`}
                    >
                      👥 +{' '}
                      {packageMates
                        .map((m) => `${m.first_name} ${m.last_name}`)
                        .join(', ')}
                    </span>
                  )}
                </p>
                {ownerTeam ? (
                  <p className="text-xs text-neutral-500 truncate">
                    Drafted by {ownerTeam.name}
                  </p>
                ) : reservingTeam ? (
                  <p
                    className={`text-xs truncate ${
                      reservedForMe ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {reservedForMe ? 'Reserved for you' : `Reserved for ${reservingTeam.name}`}
                  </p>
                ) : null}
              </div>
              <span className="text-sm tabular-nums text-neutral-300">
                {fmtPoints(p.point_value)}
              </span>
              {!drafted && canPick && (
                <button
                  onClick={() => onPick(p)}
                  className="text-xs rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold px-3 py-1.5 whitespace-nowrap"
                >
                  {pickButtonLabel}
                </button>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="px-3 py-6 text-center text-neutral-500 text-sm">No players match.</li>
        )}
      </ul>
    </div>
  );
}
