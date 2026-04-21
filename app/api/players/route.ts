import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import type { Gender, Position } from '@/lib/supabase/types';

type PlayerInput = {
  first_name: string;
  last_name: string;
  position: Position;
  gender: Gender;
  point_value: number;
};

function validate(input: Partial<PlayerInput>): { ok: true; value: PlayerInput } | { ok: false; error: string } {
  if (!input.first_name?.trim()) return { ok: false, error: 'first_name required' };
  if (!input.last_name?.trim()) return { ok: false, error: 'last_name required' };
  if (!input.position || !['F', 'D', 'FD', 'G'].includes(input.position))
    return { ok: false, error: 'position must be F, D, FD, or G' };
  if (!input.gender || !['M', 'F'].includes(input.gender))
    return { ok: false, error: 'gender must be M or F' };
  if (typeof input.point_value !== 'number' || Number.isNaN(input.point_value) || input.point_value < 0)
    return { ok: false, error: 'point_value must be a non-negative number' };
  return {
    ok: true,
    value: {
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      position: input.position,
      gender: input.gender,
      point_value: Math.round(input.point_value),
    },
  };
}

async function requireSetupCommissioner() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, status')
    .eq('id', session.draftId)
    .single();
  if (!draft) {
    return { error: NextResponse.json({ error: 'Draft not found' }, { status: 404 }) };
  }
  if (draft.status !== 'setup') {
    return {
      error: NextResponse.json(
        { error: 'Player edits are only allowed before the draft starts.' },
        { status: 409 },
      ),
    };
  }
  return { sb, draftId: draft.id };
}

export async function POST(req: Request) {
  const auth = await requireSetupCommissioner();
  if ('error' in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as Partial<PlayerInput> | null;
  const result = validate(body ?? {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const { error, data } = await auth.sb
    .from('players')
    .insert({ ...result.value, draft_id: auth.draftId })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

export async function PATCH(req: Request) {
  const auth = await requireSetupCommissioner();
  if ('error' in auth) return auth.error;
  const body = (await req.json().catch(() => null)) as
    | (Partial<PlayerInput> & { id: string })
    | null;
  if (!body?.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const result = validate(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  const { error } = await auth.sb
    .from('players')
    .update(result.value)
    .eq('id', body.id)
    .eq('draft_id', auth.draftId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await requireSetupCommissioner();
  if ('error' in auth) return auth.error;
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { error } = await auth.sb
    .from('players')
    .delete()
    .eq('id', id)
    .eq('draft_id', auth.draftId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
