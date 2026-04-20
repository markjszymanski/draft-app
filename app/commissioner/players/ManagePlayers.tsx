'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Gender, Package, Player, Position } from '@/lib/supabase/types';
import { positionBadge, positionBadgeClass } from '@/lib/utils';

const inputCls =
  'rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm focus:outline-none focus:border-emerald-500';

export function ManagePlayers({
  initialPlayers,
  initialPackages,
}: {
  initialPlayers: Player[];
  initialPackages: Package[];
}) {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [packages, setPackages] = useState<Package[]>(initialPackages);
  const packageLabelById = useMemo(
    () => new Map(packages.map((p) => [p.id, p.label ?? 'package'])),
    [packages],
  );
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'ALL' | Position>('ALL');
  const [search, setSearch] = useState('');
  const [importText, setImportText] = useState('');
  const [importReplace, setImportReplace] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = players;
    if (filter !== 'ALL') rows = rows.filter((p) => p.position === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.first_name.toLowerCase().includes(q) || p.last_name.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [players, filter, search]);

  async function refresh() {
    router.refresh();
    const res = await fetch('/api/players/list', { cache: 'no-store' }).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setPlayers(json.players);
      setPackages(json.packages ?? []);
    }
  }

  async function setPackageFor(playerIds: string[], label: string | null) {
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds, label }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to update package');
      return;
    }
    refresh();
  }

  async function importBulk() {
    setImportMsg(null);
    setBusy(true);
    const res = await fetch('/api/players/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: importText, replace: importReplace }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setImportMsg(`Error: ${json.error ?? 'Import failed'}`);
      return;
    }
    setImportMsg(`Imported ${json.imported} players${json.skipped ? `, skipped ${json.skipped}` : ''}.`);
    setImportText('');
    setImportReplace(false);
    refresh();
  }

  async function addPlayer(p: {
    first_name: string;
    last_name: string;
    position: Position;
    gender: Gender;
    point_value: number;
  }) {
    setBusy(true);
    const res = await fetch('/api/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to add');
      return;
    }
    setAddOpen(false);
    refresh();
  }

  async function savePlayer(p: Player) {
    setBusy(true);
    const res = await fetch('/api/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        position: p.position,
        gender: p.gender,
        point_value: p.point_value,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to save');
      return;
    }
    setEditingId(null);
    refresh();
  }

  async function deletePlayer(id: string) {
    if (!confirm('Delete this player?')) return;
    setBusy(true);
    const res = await fetch(`/api/players?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to delete');
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-8">
      <PackagesPanel
        players={players}
        packages={packages}
        packageLabelById={packageLabelById}
        onChanged={refresh}
      />
      <TestGenerator
        onGenerated={() => refresh()}
      />
      <section className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
        <header className="flex items-baseline justify-between">
          <h2 className="font-semibold">Bulk import</h2>
          <span className="text-xs text-neutral-500">
            Paste from Excel/Sheets/CSV. Tabs or commas both work.
          </span>
        </header>
        <p className="text-xs text-neutral-400">
          Required columns: <code>first_name, last_name, position, points</code>. Optional:{' '}
          <code>gender</code> (defaults to M), <code>package</code> (any rows sharing a non-empty
          package label become a package — drafting one reserves the others). Header row required.
        </p>
        <textarea
          rows={6}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder={`first_name,last_name,position,gender,points,package\nRyan,McKenzie,F,M,950,\nSteve,Sullivan,F,M,800,sullivans\nJohn,Sullivan,D,M,750,sullivans`}
          className={`${inputCls} w-full font-mono text-xs`}
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="text-sm flex items-center gap-2 text-neutral-300">
            <input
              type="checkbox"
              checked={importReplace}
              onChange={(e) => setImportReplace(e.target.checked)}
            />
            Replace the entire pool with this list
          </label>
          <button
            onClick={importBulk}
            disabled={busy || !importText.trim()}
            className="rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import players'}
          </button>
        </div>
        {importMsg && (
          <p
            className={`text-sm ${
              importMsg.startsWith('Error') ? 'text-rose-400' : 'text-emerald-300'
            }`}
          >
            {importMsg}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold">Players ({players.length})</h2>
            <div className="flex gap-1 text-xs">
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
                  {f === 'ALL' ? 'All' : f === 'FD' ? 'F/D' : f}
                </button>
              ))}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className={`${inputCls} w-48`}
            />
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="rounded bg-neutral-800 hover:bg-neutral-700 text-sm font-semibold px-3 py-2"
          >
            + Add player
          </button>
        </header>

        {addOpen && (
          <PlayerForm
            initial={{ first_name: '', last_name: '', position: 'F', gender: 'M', point_value: 500 }}
            onCancel={() => setAddOpen(false)}
            onSave={(p) => addPlayer(p)}
            saveLabel="Add"
          />
        )}

        <ul className="divide-y divide-neutral-900 border border-neutral-800 rounded">
          {filtered.map((p) => {
            const isDrafted = !!p.drafted_by_team_id;
            const isEditing = editingId === p.id;
            if (isEditing) {
              return (
                <li key={p.id} className="px-3 py-2">
                  <PlayerForm
                    initial={p}
                    onCancel={() => setEditingId(null)}
                    onSave={(updated) => savePlayer({ ...p, ...updated })}
                    saveLabel="Save"
                  />
                </li>
              );
            }
            const pkgLabel = p.package_id ? packageLabelById.get(p.package_id) : null;
            return (
              <li key={p.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                <span
                  className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                    p.position,
                  )}`}
                >
                  {positionBadge(p.position)}
                </span>
                <span className="flex-1 truncate flex items-center gap-2">
                  <span className={p.gender === 'F' ? 'italic text-pink-300' : ''}>
                    {p.first_name} {p.last_name}
                  </span>
                  {pkgLabel && (
                    <span className="text-[10px] text-neutral-300 bg-neutral-800 rounded px-1 py-0.5 shrink-0">
                      👥 {pkgLabel}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-neutral-300 w-16 text-right">
                  {p.point_value}
                </span>
                <button
                  onClick={() => {
                    const current = pkgLabel ?? '';
                    const next = prompt(
                      'Package label (leave blank to remove):',
                      current,
                    );
                    if (next === null) return;
                    setPackageFor([p.id], next.trim() ? next.trim() : null);
                  }}
                  disabled={isDrafted}
                  className="text-xs text-violet-300 hover:text-violet-200 disabled:opacity-40"
                  title="Set package"
                >
                  Package
                </button>
                <button
                  onClick={() => setEditingId(p.id)}
                  disabled={isDrafted}
                  className="text-xs text-neutral-400 hover:text-neutral-100 disabled:opacity-40"
                  title={isDrafted ? 'Already drafted' : 'Edit'}
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePlayer(p.id)}
                  disabled={isDrafted}
                  className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-40"
                  title={isDrafted ? 'Already drafted' : 'Delete'}
                >
                  Delete
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-6 text-center text-neutral-500 text-sm">No players.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function PlayerForm({
  initial,
  onCancel,
  onSave,
  saveLabel,
}: {
  initial: { first_name: string; last_name: string; position: Position; gender: Gender; point_value: number };
  onCancel: () => void;
  onSave: (p: { first_name: string; last_name: string; position: Position; gender: Gender; point_value: number }) => void;
  saveLabel: string;
}) {
  const [firstName, setFirstName] = useState(initial.first_name);
  const [lastName, setLastName] = useState(initial.last_name);
  const [position, setPosition] = useState<Position>(initial.position);
  const [gender, setGender] = useState<Gender>(initial.gender);
  const [points, setPoints] = useState<number>(initial.point_value);

  return (
    <div className="grid grid-cols-[1fr_1fr_4rem_4rem_5rem_auto_auto] gap-2 items-center">
      <input
        className={inputCls}
        placeholder="First"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
      />
      <input
        className={inputCls}
        placeholder="Last"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
      />
      <select
        className={inputCls}
        value={position}
        onChange={(e) => setPosition(e.target.value as Position)}
      >
        <option value="F">F</option>
        <option value="D">D</option>
        <option value="FD">F/D</option>
        <option value="G">G</option>
      </select>
      <select
        className={inputCls}
        value={gender}
        onChange={(e) => setGender(e.target.value as Gender)}
      >
        <option value="M">M</option>
        <option value="F">W</option>
      </select>
      <input
        type="number"
        className={inputCls}
        value={points}
        onChange={(e) => setPoints(Number(e.target.value))}
      />
      <button
        onClick={() =>
          onSave({
            first_name: firstName,
            last_name: lastName,
            position,
            gender,
            point_value: points,
          })
        }
        className="rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-semibold px-3 py-2"
      >
        {saveLabel}
      </button>
      <button
        onClick={onCancel}
        className="rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold px-3 py-2"
      >
        Cancel
      </button>
    </div>
  );
}

function TestGenerator({ onGenerated }: { onGenerated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    forwards_men: 40,
    forwards_women: 20,
    defense_men: 30,
    defense_women: 15,
    fd_men: 8,
    fd_women: 4,
    goalies_men: 6,
    goalies_women: 4,
  });

  function update(key: keyof typeof counts, value: number) {
    setCounts((c) => ({ ...c, [key]: Math.max(0, value) }));
  }

  async function generate() {
    setMsg(null);
    setBusy(true);
    const res = await fetch('/api/players/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(counts),
    });
    setBusy(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(`Error: ${json.error ?? 'Failed'}`);
      return;
    }
    setMsg(`Added ${json.added} test players.`);
    onGenerated();
  }

  return (
    <details
      className="rounded-lg border border-neutral-800 bg-neutral-900/50"
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm text-neutral-300 hover:text-neutral-100 font-semibold">
        Generate test players (testing only)
      </summary>
      <div className="p-4 border-t border-neutral-800 space-y-3">
        <p className="text-xs text-neutral-500">
          Adds random fake players to the pool. For end-to-end testing — skip this with the real list.
        </p>
        <div className="grid grid-cols-[6rem_1fr_1fr] gap-2 items-center text-sm">
          <span className="text-neutral-400 text-xs uppercase tracking-wider"></span>
          <span className="text-sky-300 text-xs uppercase tracking-wider text-center">Men</span>
          <span className="text-pink-300 text-xs uppercase tracking-wider text-center">Women</span>

          <span className="text-neutral-300">Forwards</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.forwards_men}
            onChange={(e) => update('forwards_men', Number(e.target.value))}
          />
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.forwards_women}
            onChange={(e) => update('forwards_women', Number(e.target.value))}
          />

          <span className="text-neutral-300">Defensemen</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.defense_men}
            onChange={(e) => update('defense_men', Number(e.target.value))}
          />
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.defense_women}
            onChange={(e) => update('defense_women', Number(e.target.value))}
          />

          <span className="text-violet-300">F/D</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.fd_men}
            onChange={(e) => update('fd_men', Number(e.target.value))}
          />
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.fd_women}
            onChange={(e) => update('fd_women', Number(e.target.value))}
          />

          <span className="text-neutral-300">Goalies</span>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.goalies_men}
            onChange={(e) => update('goalies_men', Number(e.target.value))}
          />
          <input
            type="number"
            min={0}
            className={inputCls}
            value={counts.goalies_women}
            onChange={(e) => update('goalies_women', Number(e.target.value))}
          />
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-neutral-500">
            Total: {Object.values(counts).reduce((a, b) => a + b, 0)} players
          </span>
          <button
            onClick={generate}
            disabled={busy}
            className="rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Generating…' : 'Add test players'}
          </button>
        </div>
        {msg && (
          <p className={`text-sm ${msg.startsWith('Error') ? 'text-rose-400' : 'text-emerald-300'}`}>
            {msg}
          </p>
        )}
      </div>
    </details>
  );
}

// Groups players by package and shows one card per package with remove/dissolve
// controls. Hidden when there are zero packages.
function PackagesPanel({
  players,
  packages,
  packageLabelById,
  onChanged,
}: {
  players: Player[];
  packages: Package[];
  packageLabelById: Map<string, string>;
  onChanged: () => void;
}) {
  const grouped = useMemo(() => {
    const byId = new Map<string, Player[]>();
    for (const p of players) {
      if (!p.package_id) continue;
      if (!byId.has(p.package_id)) byId.set(p.package_id, []);
      byId.get(p.package_id)!.push(p);
    }
    // Sort members within each package by points desc
    for (const members of byId.values()) {
      members.sort((a, b) => b.point_value - a.point_value);
    }
    // Sort packages by label
    return Array.from(byId.entries())
      .map(([id, members]) => ({
        id,
        label: packageLabelById.get(id) ?? 'package',
        members,
        total: members.reduce((s, m) => s + m.point_value, 0),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [players, packages, packageLabelById]);

  const freeCount = players.filter((p) => !p.package_id).length;

  async function dissolve(pkgId: string, label: string) {
    if (!confirm(`Dissolve package "${label}"? All members become unpackaged.`)) return;
    const res = await fetch(`/api/packages?id=${pkgId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to dissolve');
      return;
    }
    onChanged();
  }

  async function removeMember(playerId: string, playerName: string, label: string) {
    if (!confirm(`Remove ${playerName} from package "${label}"?`)) return;
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerIds: [playerId], label: null }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error ?? 'Failed to remove');
      return;
    }
    onChanged();
  }

  return (
    <details className="rounded-lg border border-neutral-800 bg-neutral-900/50" open>
      <summary className="cursor-pointer px-4 py-3 text-sm text-neutral-300 hover:text-neutral-100 font-semibold flex items-center justify-between">
        <span>
          Packages ({grouped.length})
          {grouped.length > 0 && (
            <span className="text-neutral-500 font-normal">
              {' '}
              · {players.length - freeCount} players grouped · {freeCount} free agents
            </span>
          )}
        </span>
      </summary>
      <div className="p-4 border-t border-neutral-800 space-y-3">
        {grouped.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No packages yet. Use the Package button on a player row to group people together.
          </p>
        ) : (
          grouped.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded border border-neutral-800 bg-neutral-950"
            >
              <header className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-neutral-500">👥</span>
                  <span className="font-semibold text-violet-300">{pkg.label}</span>
                  <span className="text-xs text-neutral-500">({pkg.members.length})</span>
                  <span className="text-xs text-neutral-500">· {pkg.total} pts</span>
                </div>
                <button
                  onClick={() => dissolve(pkg.id, pkg.label)}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Dissolve
                </button>
              </header>
              <ul className="divide-y divide-neutral-900">
                {pkg.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span
                      className={`w-9 text-center text-xs font-bold rounded ${positionBadgeClass(
                        m.position,
                      )}`}
                    >
                      {positionBadge(m.position)}
                    </span>
                    <span
                      className={`flex-1 truncate ${
                        m.gender === 'F' ? 'italic text-pink-300' : ''
                      }`}
                    >
                      {m.first_name} {m.last_name}
                    </span>
                    <span className="tabular-nums text-neutral-300 w-14 text-right">
                      {m.point_value}
                    </span>
                    <button
                      onClick={() => removeMember(m.id, `${m.first_name} ${m.last_name}`, pkg.label)}
                      className="text-xs text-neutral-500 hover:text-rose-400"
                      title="Remove from package"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
