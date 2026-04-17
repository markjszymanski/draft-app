import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sb = createServiceClient();
  const [{ data: players }, { data: packages }] = await Promise.all([
    sb
      .from('players')
      .select('*')
      .eq('draft_id', session.draftId)
      .order('position')
      .order('point_value', { ascending: false }),
    sb.from('packages').select('*').eq('draft_id', session.draftId),
  ]);
  return NextResponse.json({ players: players ?? [], packages: packages ?? [] });
}
