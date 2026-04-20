import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { SetupNav } from '../SetupNav';
import { ManageTeams } from './ManageTeams';
import type { Player, Team } from '@/lib/supabase/types';

export default async function TeamsPage() {
  const session = await getSession();
  if (!session?.isCommissioner) redirect('/commissioner/login');
  if (session.draftId === 'pending') redirect('/commissioner/login');

  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, name, status')
    .eq('id', session.draftId)
    .single();
  if (!draft) redirect('/commissioner/login');

  const [{ data: teams }, { data: players }] = await Promise.all([
    sb.from('teams').select('*').eq('draft_id', draft.id).order('draft_position'),
    sb
      .from('players')
      .select('*')
      .eq('draft_id', draft.id)
      .order('last_name'),
  ]);

  return (
    <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Teams</h1>
        <Link href="/commissioner" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back to draft
        </Link>
      </header>

      <SetupNav active="teams" />

      {draft.status !== 'setup' ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
          The draft has started. Team edits are locked.
        </div>
      ) : (
        <ManageTeams
          initialTeams={(teams ?? []) as Team[]}
          players={(players ?? []) as Player[]}
        />
      )}
    </main>
  );
}
