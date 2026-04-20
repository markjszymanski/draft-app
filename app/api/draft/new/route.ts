import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { setSession } from '@/lib/auth';

function genPasscode(len = 7): string {
  return Array.from({ length: len }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
  ).join('');
}

// Create a new draft with sensible defaults. The commissioner then edits
// everything on the Draft Settings / Players / Teams tabs.
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

  const { data: draft, error } = await sb
    .from('drafts')
    .insert({
      name: 'New draft',
      year: new Date().getFullYear(),
      salary_cap: 10000,
      pick_timer_seconds: 120,
      draft_mode: 'snake',
      roster_size: 0,
      status: 'setup',
      current_pick_number: 1,
      commissioner_passcode: genPasscode(),
    })
    .select('id')
    .single();

  if (error || !draft) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to create draft' },
      { status: 500 },
    );
  }

  await setSession({ draftId: draft.id, isCommissioner: true });
  return NextResponse.json({ ok: true, draftId: draft.id });
}
