import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { CommissionerControls } from './CommissionerControls';
import { HeaderMenu } from './HeaderMenu';
import { DraftView } from '../draft/DraftView';

export default async function CommissionerPage() {
  const session = await getSession();
  if (!session?.isCommissioner) redirect('/commissioner/login');
  if (session.draftId === 'pending') redirect('/commissioner/setup');

  const sb = createServiceClient();
  const { data: draft } = await sb.from('drafts').select('*').eq('id', session.draftId).single();
  if (!draft) redirect('/commissioner/setup');

  const { count: playerCount } = await sb
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', draft.id);

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">{draft.name} · Commissioner</h1>
          <p className="text-xs text-neutral-400 uppercase tracking-wider">{draft.status}</p>
        </div>
        <HeaderMenu status={draft.status} />
      </header>
      <CommissionerControls
        status={draft.status}
        playerCount={playerCount ?? 0}
      />
      <DraftView draftId={draft.id} viewerTeamId={null} isCommissioner />
    </div>
  );
}
