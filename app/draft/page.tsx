import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { DraftView } from './DraftView';

export default async function DraftPage() {
  const session = await getSession();
  if (!session?.draftId || session.draftId === 'pending') redirect('/');

  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, name, status')
    .eq('id', session.draftId)
    .single();

  if (!draft) redirect('/');

  let teamName: string | null = null;
  if (session.teamId) {
    const { data: team } = await sb
      .from('teams')
      .select('name')
      .eq('id', session.teamId)
      .single();
    teamName = team?.name ?? null;
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">{draft.name}</h1>
          <p className="text-xs text-neutral-400">
            {teamName ? `You are: ${teamName}` : 'Spectator'} ·{' '}
            <span className="uppercase tracking-wider">{draft.status}</span>
          </p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="text-xs text-neutral-400 hover:text-neutral-100" type="submit">
            Sign out
          </button>
        </form>
      </header>
      <DraftView draftId={draft.id} viewerTeamId={session.teamId ?? null} isCommissioner={false} />
    </div>
  );
}
