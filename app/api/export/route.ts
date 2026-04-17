import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(','));
  }
  return lines.join('\n');
}

function safeFilename(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') ?? 'team';

  const sb = createServiceClient();
  const [draftRes, teamsRes, picksRes, playersRes] = await Promise.all([
    sb.from('drafts').select('*').eq('id', session.draftId).single(),
    sb.from('teams').select('*').eq('draft_id', session.draftId).order('draft_position'),
    sb.from('picks').select('*').eq('draft_id', session.draftId).order('pick_number'),
    sb.from('players').select('*').eq('draft_id', session.draftId),
  ]);

  if (!draftRes.data) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  const draft = draftRes.data;
  const teams = teamsRes.data ?? [];
  const picks = picksRes.data ?? [];
  const players = playersRes.data ?? [];
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamCount = teams.length || 1;

  let csv = '';
  let filenameSuffix = '_results';

  if (scope === 'team') {
    if (!session.teamId) {
      return NextResponse.json({ error: 'No team in session' }, { status: 400 });
    }
    const scopedPicks = picks.filter((p) => p.team_id === session.teamId);
    const team = teamById.get(session.teamId);
    filenameSuffix = `_${team ? safeFilename(team.name) : 'team'}_results`;
    csv = toCsv(scopedPicks.map((pick) => pickRow(pick, teamById, playerById, teamCount)));
  } else if (scope === 'all') {
    if (!session.isCommissioner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    csv = toCsv(picks.map((pick) => pickRow(pick, teamById, playerById, teamCount)));
  } else if (scope === 'teams') {
    if (!session.isCommissioner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    filenameSuffix = '_teams';
    const sections: string[] = [];
    for (const team of teams) {
      const teamPicks = picks
        .filter((p) => p.team_id === team.id)
        .sort((a, b) => a.pick_number - b.pick_number);
      sections.push(
        `${team.name}${team.captain_name ? ` (${team.captain_name})` : ''}`,
      );
      sections.push('Round,Pick,Position,Gender,First Name,Last Name,Points');
      for (const pick of teamPicks) {
        const p = playerById.get(pick.player_id);
        const pickInRound = ((pick.pick_number - 1) % teamCount) + 1;
        sections.push(
          [
            pick.round,
            pickInRound,
            p?.position ?? '',
            p?.gender ?? '',
            p?.first_name ?? '',
            p?.last_name ?? '',
            p?.point_value ?? '',
          ]
            .map(csvCell)
            .join(','),
        );
      }
      sections.push('');
    }
    csv = sections.join('\n');
  } else {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  }

  const filename = `${safeFilename(draft.name)}_${draft.year}${filenameSuffix}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function pickRow(
  pick: { pick_number: number; round: number; team_id: string; player_id: string },
  teamById: Map<string, { name: string; captain_name: string | null }>,
  playerById: Map<string, { first_name: string; last_name: string; position: string; gender: string; point_value: number }>,
  teamCount: number,
): Record<string, unknown> {
  const team = teamById.get(pick.team_id);
  const player = playerById.get(pick.player_id);
  const pickInRound = ((pick.pick_number - 1) % teamCount) + 1;
  return {
    round: pick.round,
    pick_in_round: pickInRound,
    overall_pick: pick.pick_number,
    team: team?.name ?? '',
    captain: team?.captain_name ?? '',
    first_name: player?.first_name ?? '',
    last_name: player?.last_name ?? '',
    position: player?.position ?? '',
    gender: player?.gender ?? '',
    points: player?.point_value ?? '',
  };
}
