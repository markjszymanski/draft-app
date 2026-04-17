import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

// Stars are scoped to the viewing team. Commissioners and spectators have no team
// and so have no stars — these endpoints return empty / no-op for them.

export async function GET() {
  const session = await getSession();
  if (!session?.teamId) return NextResponse.json({ playerIds: [] });
  const sb = createServiceClient();
  const { data } = await sb
    .from('team_starred_players')
    .select('player_id')
    .eq('team_id', session.teamId);
  return NextResponse.json({ playerIds: (data ?? []).map((r) => r.player_id) });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.teamId) {
    return NextResponse.json({ error: 'Only teams can star players.' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const playerId = body?.playerId as string | undefined;
  if (!playerId) return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb
    .from('team_starred_players')
    .insert({ team_id: session.teamId, player_id: playerId });
  // Ignore duplicate-star conflicts — already starred is a no-op.
  if (error && !error.message.toLowerCase().includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session?.teamId) {
    return NextResponse.json({ error: 'Only teams can unstar players.' }, { status: 403 });
  }
  const url = new URL(req.url);
  const playerId = url.searchParams.get('playerId');
  if (!playerId) return NextResponse.json({ error: 'Missing playerId' }, { status: 400 });

  const sb = createServiceClient();
  const { error } = await sb
    .from('team_starred_players')
    .delete()
    .eq('team_id', session.teamId)
    .eq('player_id', playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
