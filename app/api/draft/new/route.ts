import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { setSession } from '@/lib/auth';

export async function POST() {
  const sb = createServiceClient();

  // Block if there's already a setup/active draft. Force the commissioner to
  // explicitly abandon it from the in-app menu first — safer than silently nuking.
  const { data: inProgress } = await sb
    .from('drafts')
    .select('id, name, status')
    .in('status', ['setup', 'active', 'paused'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inProgress) {
    return NextResponse.json(
      {
        error: `A draft (${inProgress.name}) is already ${inProgress.status}. Log into it and abandon or end it from the gear menu first.`,
      },
      { status: 409 },
    );
  }

  await setSession({ draftId: 'pending', isCommissioner: true });
  return NextResponse.json({ ok: true });
}
