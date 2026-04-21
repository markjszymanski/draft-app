import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

// Commissioner decides "don't use a claim this pick — let the on-clock team
// draft someone else". Flag is stored on the draft row and cleared automatically
// when the pick advances, so every client unblocks via realtime.
export async function POST() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, status, current_pick_number')
    .eq('id', session.draftId)
    .single();
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.status !== 'active') {
    return NextResponse.json({ error: 'Draft is not active' }, { status: 409 });
  }

  const { error } = await sb
    .from('drafts')
    .update({ claim_skipped_for_pick: draft.current_pick_number })
    .eq('id', draft.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
