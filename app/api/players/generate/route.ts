import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { generatePlayerPool } from '@/lib/seed-data';

type Body = {
  forwards_men?: number;
  forwards_women?: number;
  defense_men?: number;
  defense_women?: number;
  fd_men?: number;
  fd_women?: number;
  goalies_men?: number;
  goalies_women?: number;
};

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? Math.floor(x) : 0;
}

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
  if (!draft) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (draft.status !== 'setup') {
    return NextResponse.json(
      { error: 'Adding players is locked once the draft starts.' },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const fM = n(body.forwards_men);
  const fW = n(body.forwards_women);
  const dM = n(body.defense_men);
  const dW = n(body.defense_women);
  const fdM = n(body.fd_men);
  const fdW = n(body.fd_women);
  const gM = n(body.goalies_men);
  const gW = n(body.goalies_women);
  const total = fM + fW + dM + dW + fdM + fdW + gM + gW;
  if (total === 0) {
    return NextResponse.json({ error: 'Pick at least one count to generate.' }, { status: 400 });
  }

  // Reuse the seed generator one position at a time so we can control gender ratios.
  const pool: ReturnType<typeof generatePlayerPool> = [];
  if (fM + fW > 0) {
    pool.push(...generatePlayerPool({ forwards: fM + fW, defense: 0, goalies: 0, fd: 0, femaleRatio: fW / (fM + fW) }));
  }
  if (dM + dW > 0) {
    pool.push(...generatePlayerPool({ defense: dM + dW, forwards: 0, goalies: 0, fd: 0, femaleRatio: dW / (dM + dW) }));
  }
  if (fdM + fdW > 0) {
    pool.push(...generatePlayerPool({ fd: fdM + fdW, forwards: 0, defense: 0, goalies: 0, femaleRatio: fdW / (fdM + fdW) }));
  }
  if (gM + gW > 0) {
    pool.push(...generatePlayerPool({ goalies: gM + gW, forwards: 0, defense: 0, fd: 0, femaleRatio: gW / (gM + gW) }));
  }

  const rows = pool.map((p) => ({ ...p, draft_id: draft.id }));
  const { error } = await sb.from('players').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Recompute roster_size since we changed the pool.
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

  return NextResponse.json({ ok: true, added: rows.length });
}
