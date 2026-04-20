import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { SettingsForm } from './SettingsForm';
import { SetupNav } from '../SetupNav';

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.isCommissioner) redirect('/commissioner/login');
  if (session.draftId === 'pending') redirect('/commissioner/login');

  const sb = createServiceClient();
  const { data: draft } = await sb.from('drafts').select('*').eq('id', session.draftId).single();
  if (!draft) redirect('/commissioner/login');

  return (
    <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Draft settings</h1>
        <Link href="/commissioner" className="text-sm text-neutral-400 hover:text-neutral-100">
          ← Back to draft
        </Link>
      </header>

      <SetupNav active="settings" />

      {draft.status !== 'setup' ? (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-amber-200 text-sm">
          The draft has started. Settings are locked.
        </div>
      ) : (
        <SettingsForm draft={draft} />
      )}
    </main>
  );
}
