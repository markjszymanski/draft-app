import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session?.isCommissioner || !session.draftId || session.draftId === 'pending') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, current_pick_number, status')
    .eq('id', session.draftId)
    .single();

  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  const { data: lastPick } = await sb
    .from('picks')
    .select('id, pick_number, player_id, team_id')
    .eq('draft_id', draft.id)
    .order('pick_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastPick) {
    return NextResponse.json({ error: 'No picks to undo' }, { status: 409 });
  }

  // Find any players whose claim was triggered by this pick — those are the
  // package teammates we claimed when this pick happened. If non-empty, this
  // was the package *originator*: clear those claims (and any chain on through
  // the picks table cascades the FK to null).
  const { data: claimedByThisPick } = await sb
    .from('players')
    .select('id')
    .eq('claim_originator_pick_id', lastPick.id);
  const wasPackageOriginator = (claimedByThisPick ?? []).length > 0;

  // Was the undone pick *fulfilling* an existing claim? If so, the player had a
  // claim row before being drafted. We can't tell after the fact directly, but
  // we can infer: the player has package teammates that the same team owns
  // (drafted or claimed), AND this pick wasn't the originator. In that case,
  // restore the claim on the undone player.
  const { data: undonePlayer } = await sb
    .from('players')
    .select('id, package_id')
    .eq('id', lastPick.player_id)
    .single();

  // Capture claimed teammate IDs before deleting the pick (FK will null out
   // claim_originator_pick_id on cascade, losing the link).
  const teammateIdsToClear = (claimedByThisPick ?? []).map((p) => p.id);

  await sb.from('picks').delete().eq('id', lastPick.id);

  // If this was the originator, clear the claims we made on the teammates.
  if (teammateIdsToClear.length > 0) {
    await sb
      .from('players')
      .update({ reserved_for_team_id: null, claim_originator_pick_id: null })
      .in('id', teammateIdsToClear);
  }

  let restoredReservedFor: string | null = null;
  if (!wasPackageOriginator && undonePlayer?.package_id) {
    const { data: teammates } = await sb
      .from('players')
      .select('id, reserved_for_team_id, drafted_by_team_id')
      .eq('package_id', undonePlayer.package_id)
      .neq('id', undonePlayer.id);
    const teammateOwnedByTeam = new Set(
      (teammates ?? [])
        .map((t) =>
          t.reserved_for_team_id ?? t.drafted_by_team_id,
        )
        .filter(Boolean) as string[],
    );
    if (lastPick.team_id && teammateOwnedByTeam.has(lastPick.team_id)) {
      restoredReservedFor = lastPick.team_id;
    }
  }

  await sb
    .from('players')
    .update({
      drafted_by_team_id: null,
      reserved_for_team_id: restoredReservedFor,
      claim_originator_pick_id: null,
    })
    .eq('id', lastPick.player_id);
  await sb
    .from('drafts')
    .update({
      current_pick_number: lastPick.pick_number,
      current_pick_started_at: new Date().toISOString(),
      status: 'active',
    })
    .eq('id', draft.id);

  return NextResponse.json({ ok: true });
}
