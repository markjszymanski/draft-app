import Link from 'next/link';

const tabs = [
  { id: 'settings', href: '/commissioner/settings', label: 'Draft settings' },
  { id: 'players', href: '/commissioner/players', label: 'Players' },
  { id: 'teams', href: '/commissioner/teams', label: 'Teams' },
] as const;

export function SetupNav({ active }: { active: 'settings' | 'players' | 'teams' }) {
  return (
    <nav className="flex border-b border-neutral-800 mb-6 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={t.href}
          className={`px-4 py-2 -mb-px border-b-2 ${
            t.id === active
              ? 'border-emerald-500 text-neutral-100 font-semibold'
              : 'border-transparent text-neutral-400 hover:text-neutral-100'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
