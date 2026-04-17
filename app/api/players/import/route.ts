import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import type { Gender, Position } from '@/lib/supabase/types';

type ImportBody = {
  text: string;
  replace?: boolean;
};

type Row = {
  first_name: string;
  last_name: string;
  position: Position;
  gender: Gender;
  point_value: number;
  package: string;
};

const POSITION_MAP: Record<string, Position> = {
  f: 'F',
  forward: 'F',
  forwards: 'F',
  fwd: 'F',
  d: 'D',
  defense: 'D',
  defenseman: 'D',
  defensemen: 'D',
  def: 'D',
  g: 'G',
  goalie: 'G',
  goalies: 'G',
  goaltender: 'G',
  gk: 'G',
  fd: 'FD',
  'f/d': 'FD',
  'f,d': 'FD',
  'd/f': 'FD',
  'd,f': 'FD',
  'forwarddefense': 'FD',
  'forward/defense': 'FD',
  'f-d': 'FD',
};

const GENDER_MAP: Record<string, Gender> = {
  m: 'M',
  male: 'M',
  man: 'M',
  men: 'M',
  f: 'F',
  female: 'F',
  woman: 'F',
  women: 'F',
  w: 'F',
};

function splitLine(line: string): string[] {
  // Tab first, then comma. Quoted CSV not strictly handled — fine for paste-from-sheet.
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
  return parseCsvLine(line);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HEADER_ALIASES: Record<string, keyof Row> = {
  firstname: 'first_name',
  fname: 'first_name',
  first: 'first_name',
  lastname: 'last_name',
  lname: 'last_name',
  last: 'last_name',
  surname: 'last_name',
  position: 'position',
  pos: 'position',
  gender: 'gender',
  sex: 'gender',
  pointvalue: 'point_value',
  points: 'point_value',
  value: 'point_value',
  pts: 'point_value',
  rating: 'point_value',
  score: 'point_value',
  package: 'package',
  packageid: 'package',
  group: 'package',
  bundle: 'package',
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, status')
    .eq('id', session.draftId)
    .single();
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.status !== 'setup') {
    return NextResponse.json(
      { error: 'Player import is only allowed before the draft starts.' },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as ImportBody | null;
  if (!body?.text?.trim()) {
    return NextResponse.json({ error: 'Paste some data first.' }, { status: 400 });
  }

  const lines = body.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json(
      { error: 'Need at least a header row and one data row.' },
      { status: 400 },
    );
  }

  const headerCells = splitLine(lines[0]).map(normalizeHeader);
  const colIndex: Partial<Record<keyof Row, number>> = {};
  headerCells.forEach((h, i) => {
    const key = HEADER_ALIASES[h];
    if (key) colIndex[key] = i;
  });

  const missing = (['first_name', 'last_name', 'position', 'point_value'] as (keyof Row)[]).filter(
    (k) => colIndex[k] === undefined,
  );
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Missing required columns: ${missing.join(', ')}. Recognized headers include first_name, last_name, position, gender, points.`,
      },
      { status: 400 },
    );
  }

  const rows: Row[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]);
    const get = (key: keyof Row) => {
      const idx = colIndex[key];
      return idx !== undefined ? cells[idx] ?? '' : '';
    };

    const firstName = get('first_name').trim();
    const lastName = get('last_name').trim();
    const positionRaw = get('position').trim().toLowerCase();
    const genderRaw = get('gender').trim().toLowerCase();
    const pointsRaw = get('point_value').trim();

    if (!firstName || !lastName) {
      errors.push(`Row ${i + 1}: missing name`);
      continue;
    }
    const position = POSITION_MAP[positionRaw];
    if (!position) {
      errors.push(`Row ${i + 1}: unknown position "${positionRaw}"`);
      continue;
    }
    const gender = genderRaw ? GENDER_MAP[genderRaw] ?? null : 'M';
    if (!gender) {
      errors.push(`Row ${i + 1}: unknown gender "${genderRaw}"`);
      continue;
    }
    const pointValue = Number(pointsRaw.replace(/[^0-9.]/g, ''));
    if (Number.isNaN(pointValue) || pointValue < 0) {
      errors.push(`Row ${i + 1}: invalid points "${pointsRaw}"`);
      continue;
    }

    rows.push({
      first_name: firstName,
      last_name: lastName,
      position,
      gender,
      point_value: Math.round(pointValue),
      package: get('package').trim(),
    });
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'No valid rows.', detail: errors },
      { status: 400 },
    );
  }

  if (body.replace) {
    // Cascade clears packages for this draft (players FK is set null on delete,
    // but we want to wipe packages too so we don't leave orphan rows).
    await sb.from('players').delete().eq('draft_id', draft.id);
    await sb.from('packages').delete().eq('draft_id', draft.id);
  }

  // Resolve packages: any rows sharing the same non-empty package label become
  // one package. Singletons (label appears only once) get no package — packages
  // imply 2+ players.
  const labelCounts = new Map<string, number>();
  for (const r of rows) {
    if (!r.package) continue;
    labelCounts.set(r.package, (labelCounts.get(r.package) ?? 0) + 1);
  }
  const labelToPackageId = new Map<string, string>();
  for (const [label, count] of labelCounts) {
    if (count < 2) continue;
    const { data: pkg, error: pkgErr } = await sb
      .from('packages')
      .insert({ draft_id: draft.id, label })
      .select('id')
      .single();
    if (pkgErr || !pkg) {
      return NextResponse.json({ error: pkgErr?.message ?? 'Failed to create package' }, { status: 500 });
    }
    labelToPackageId.set(label, pkg.id);
  }

  const insertRows = rows.map((r) => ({
    first_name: r.first_name,
    last_name: r.last_name,
    position: r.position,
    gender: r.gender,
    point_value: r.point_value,
    draft_id: draft.id,
    package_id: r.package ? labelToPackageId.get(r.package) ?? null : null,
  }));
  const { error: insertErr } = await sb.from('players').insert(insertRows);
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Recompute roster_size (ceil players / teams) and update the draft.
  const { count: playerCount } = await sb
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', draft.id);
  const { count: teamCount } = await sb
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', draft.id);
  if (playerCount && teamCount) {
    await sb
      .from('drafts')
      .update({ roster_size: Math.ceil(playerCount / teamCount) })
      .eq('id', draft.id);
  }

  return NextResponse.json({
    ok: true,
    imported: rows.length,
    skipped: errors.length,
    errors,
  });
}
