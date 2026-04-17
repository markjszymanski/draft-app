import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { setSession } from '@/lib/auth';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const draftId = body?.draftId;
  const passcode = body?.passcode;
  if (!draftId || !passcode) {
    return NextResponse.json({ error: 'Missing draftId or passcode' }, { status: 400 });
  }

  const sb = createServiceClient();
  const { data: team } = await sb
    .from('teams')
    .select('id, draft_id')
    .eq('draft_id', draftId)
    .eq('passcode', passcode)
    .maybeSingle();

  if (!team) {
    return NextResponse.json({ error: 'Invalid passcode' }, { status: 401 });
  }

  await setSession({ draftId: team.draft_id, teamId: team.id });
  return NextResponse.json({ ok: true });
}
