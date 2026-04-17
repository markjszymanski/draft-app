import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { SetupForm } from './SetupForm';

export default async function SetupPage() {
  const session = await getSession();
  if (!session?.isCommissioner) redirect('/commissioner/login');

  return (
    <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Set up draft</h1>
        <p className="text-neutral-400 text-sm mt-1">
          Configure the draft, add teams, and generate the player pool.
        </p>
      </header>
      <SetupForm />
    </main>
  );
}
