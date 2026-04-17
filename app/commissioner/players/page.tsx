import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { ManagePlayers } from './ManagePlayers';
import { SetupNav } from '../SetupNav';
import type { Package, Player } from '@/lib/supabase/types';

export default async function PlayersPage() {
  const session = await getSession();
  if (!session?.isCommissioner) redirect('/commissioner/login');
  if (session.draftId === 'pending') redirect('/commissioner/setup');

  const sb = createServiceClient();
  const { data: draft } = await sb.from('drafts').select('id, name, status').eq('id', session.draftId).single();
  if (!draft) redirect('/commissioner/setup');

  const [{ data: players }, { data: packages }] = await Promise.all([
    sb
      .from('players')
      .select('*')
      .eq('draft_id', draft.id)
      .order('position')
      .order('point_value', { ascending: false }),
    sb.from('packages').select('*').eq('draft_id', draft.id),
  ]);

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Players</h1>
        <Link href="/commissioner" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back to draft
        </Link>
      </header>

      <SetupNav active="players" />

      {draft.status !== 'setup' ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
          The draft has started. Player edits are locked.
        </div>
      ) : (
        <ManagePlayers
          initialPlayers={(players ?? []) as Player[]}
          initialPackages={(packages ?? []) as Package[]}
        />
      )}
    </main>
  );
}
