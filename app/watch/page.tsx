import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { WatchView } from './WatchView';

export default async function WatchPage() {
  const sb = createServiceClient();
  const { data: draft } = await sb
    .from('drafts')
    .select('id')
    .neq('status', 'abandoned')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!draft) redirect('/');
  return <WatchView draftId={draft.id} />;
}
