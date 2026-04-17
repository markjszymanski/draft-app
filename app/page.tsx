import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import { JoinForm } from './_components/JoinForm';

export default async function Home() {
  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id, name, year, status')
    .neq('status', 'abandoned')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Ball Hockey Draft</h1>
          {draft ? (
            <p className="text-neutral-400">
              {draft.name} · {draft.year} ·{' '}
              <span className="uppercase text-xs tracking-wider">{draft.status}</span>
            </p>
          ) : (
            <p className="text-neutral-400">No draft set up yet.</p>
          )}
        </header>

        {draft ? (
          <JoinForm draftId={draft.id} />
        ) : (
          <p className="text-center text-sm text-neutral-400">
            The commissioner needs to create the draft first.
          </p>
        )}

        <div className="pt-6 border-t border-neutral-800 flex items-center justify-between text-sm text-neutral-400">
          <Link href="/watch" className="hover:text-neutral-100">
            Spectator view →
          </Link>
          <Link href="/commissioner/login" className="hover:text-neutral-100">
            Commissioner login →
          </Link>
        </div>
      </div>
    </main>
  );
}
