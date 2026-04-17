import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

type Body = {
  name?: string;
  year?: number;
  salary_cap?: number;
  pick_timer_seconds?: number;
  draft_mode?: 'linear' | 'snake';
  commissioner_passcode?: string;
};

export async function PATCH(req: Request) {
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
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  if (draft.status !== 'setup') {
    return NextResponse.json(
      { error: 'Draft settings are locked once the draft starts.' },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim();
  if (typeof body.year === 'number' && Number.isFinite(body.year)) update.year = body.year;
  if (typeof body.salary_cap === 'number' && body.salary_cap >= 0) update.salary_cap = body.salary_cap;
  if (typeof body.pick_timer_seconds === 'number' && body.pick_timer_seconds > 0)
    update.pick_timer_seconds = body.pick_timer_seconds;
  if (body.draft_mode === 'linear' || body.draft_mode === 'snake')
    update.draft_mode = body.draft_mode;
  if (typeof body.commissioner_passcode === 'string' && body.commissioner_passcode.trim())
    update.commissioner_passcode = body.commissioner_passcode.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await sb.from('drafts').update(update).eq('id', draft.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
