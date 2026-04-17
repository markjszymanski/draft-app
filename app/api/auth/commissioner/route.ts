import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { setSession } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const passcode = body?.passcode;
  if (!passcode) {
    return NextResponse.json({ error: 'Missing passcode' }, { status: 400 });
  }

  const sb = createServiceClient();
  // Match commissioner passcode on the most recent non-abandoned draft.
  const { data: draft } = await sb
    .from('drafts')
    .select('id, commissioner_passcode')
    .eq('commissioner_passcode', passcode)
    .neq('status', 'abandoned')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draft) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  await setSession({ draftId: draft.id, isCommissioner: true });
  return NextResponse.json({ ok: true });
}
