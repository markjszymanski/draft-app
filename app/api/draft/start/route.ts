import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = createServiceClient();

  // Refuse to start with an empty player pool — the simulator/UI both need players.
  // Also recompute roster_size in case players were added since setup.
  const [{ count: playerCount }, { count: teamCount }] = await Promise.all([
    sb.from('players').select('id', { count: 'exact', head: true }).eq('draft_id', session.draftId),
    sb.from('teams').select('id', { count: 'exact', head: true }).eq('draft_id', session.draftId),
  ]);
  if (!playerCount || playerCount === 0) {
    return NextResponse.json({ error: 'Add players before starting the draft.' }, { status: 409 });
  }
  if (!teamCount || teamCount === 0) {
    return NextResponse.json({ error: 'Add teams before starting the draft.' }, { status: 409 });
  }

  const rosterSize = Math.ceil(playerCount / teamCount);

  const { error } = await sb
    .from('drafts')
    .update({
      status: 'active',
      roster_size: rosterSize,
      current_pick_number: 1,
      current_pick_started_at: new Date().toISOString(),
    })
    .eq('id', session.draftId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
