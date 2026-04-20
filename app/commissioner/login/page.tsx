import { CommissionerLoginForm } from './LoginForm';
// import { NewDraftButton } from './NewDraftButton';

export default function CommissionerLoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <header className="text-center">
          <h1 className="text-3xl font-bold">Commissioner</h1>
          <p className="text-neutral-400 text-sm mt-2">
            Enter your passcode to manage the draft.
          </p>
        </header>
        <CommissionerLoginForm />
        {/*
        // Temporarily hidden — we don't want accidental new drafts on the public URL.
        // Re-enable to allow creating a new draft from the login page.
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex-1 h-px bg-neutral-800" />
          OR
          <span className="flex-1 h-px bg-neutral-800" />
        </div>
        <NewDraftButton />
        */}
      </div>
    </main>
  );
}
