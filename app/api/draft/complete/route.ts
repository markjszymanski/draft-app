import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from('drafts')
    .update({ status: 'complete', current_pick_started_at: null })
    .eq('id', session.draftId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
