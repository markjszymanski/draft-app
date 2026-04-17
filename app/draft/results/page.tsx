import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createServiceClient } from '@/lib/supabase/server';
import { teamCapUsed, rosterCounts } from '@/lib/draft-logic';
import { fmtPoints } from '@/lib/utils';
import { PrintButton } from './PrintButton';

export default async function ResultsPage() {
  const session = await getSession();
  if (!session?.draftId || session.draftId === 'pending') redirect('/');

  const sb = createServiceClient();
  const [draftRes, teamsRes, picksRes, playersRes] = await Promise.all([
    sb.from('drafts').select('*').eq('id', session.draftId).single(),
    sb.from('teams').select('*').eq('draft_id', session.draftId).order('draft_position'),
    sb.from('picks').select('*').eq('draft_id', session.draftId).order('pick_number'),
    sb.from('players').select('*').eq('draft_id', session.draftId),
  ]);

  if (!draftRes.data) redirect('/');
  const draft = draftRes.data;
  const teams = teamsRes.data ?? [];
  const picks = picksRes.data ?? [];
  const players = playersRes.data ?? [];
  const playerById = new Map(players.map((p) => [p.id, p]));
  const teamCount = teams.length || 1;

  return (
    <main className="results-page bg-white text-neutral-900 min-h-screen p-8 print:p-0">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-baseline justify-between mb-6 print:mb-4">
          <div>
            <h1 className="text-3xl font-bold">{draft.name}</h1>
            <p className="text-neutral-500">{draft.year} draft results</p>
          </div>
          <PrintButton />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:gap-3">
          {teams.map((team) => {
            const teamPicks = picks
              .filter((p) => p.team_id === team.id)
              .sort((a, b) => a.pick_number - b.pick_number);
            const used = teamCapUsed(team.id, picks, players);
            const counts = rosterCounts(team.id, picks, players);

            return (
              <section
                key={team.id}
                className="border border-neutral-300 rounded p-4 print:rounded-none print:border-neutral-400 break-inside-avoid"
              >
                <header className="border-b border-neutral-300 pb-2 mb-2">
                  <p className="text-xs text-neutral-500 tabular-nums">
                    Pick #{team.draft_position}
                  </p>
                  <h2 className="text-lg font-bold">
                    {team.name}
                    {team.captain_name && (
                      <span className="text-neutral-500 font-normal text-sm">
                        {' '}
                        — {team.captain_name}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-neutral-600">
                    {counts.total} players · F{counts.F} D{counts.D} G{counts.G} ·{' '}
                    M{counts.M} W{counts.W} · {fmtPoints(used)} / {fmtPoints(draft.salary_cap)} pts
                  </p>
                </header>
                {teamPicks.length === 0 ? (
                  <p className="text-sm text-neutral-500">No picks.</p>
                ) : (
                  <ol className="text-sm space-y-0.5">
                    {teamPicks.map((pick) => {
                      const p = playerById.get(pick.player_id);
                      if (!p) return null;
                      const pickInRound = ((pick.pick_number - 1) % teamCount) + 1;
                      return (
                        <li key={pick.id} className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500 tabular-nums w-10">
                            {pick.round}.{pickInRound.toString().padStart(2, '0')}
                          </span>
                          <span className="font-bold w-5 text-center text-xs">
                            {p.position}
                          </span>
                          <span
                            className={`flex-1 ${
                              p.gender === 'F' ? 'italic' : ''
                            }`}
                          >
                            {p.first_name} {p.last_name}
                          </span>
                          <span className="tabular-nums text-xs text-neutral-500">
                            {fmtPoints(p.point_value)}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .results-page { background: white !important; color: black !important; }
        }
      `}</style>
    </main>
  );
}
