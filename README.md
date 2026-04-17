# Ball Hockey Draft App

Live draft board for an in-person ball hockey draft. Everyone sits around a table on their phones, the commissioner runs the show, picks sync to every screen in real time.

Built for a specific co-ed ball hockey league, but the patterns are general enough to fork for any snake/linear draft (fantasy sports, picks, fantasy leagues, etc.).

## Features

- **Snake or linear** draft modes
- **Soft salary cap** with override warnings
- **Live realtime sync** across all devices (Supabase Realtime)
- **Spectator view** at `/watch` — designed to project on a TV
- **Captain stars** — favorite players you want, filter by starred
- **Player packages** — mark players as a "package deal" (e.g. siblings who must play together); drafting one claims the others
- **CSV import** of the player pool + bulk paste from Excel/Sheets
- **Roster tracking**: forwards, defensemen, F/D (hybrid), goalies, men/women counts
- **Pick timer** per pick, configurable (1–5 min)
- **Commissioner controls**: undo last pick, pick for a team, simulate remaining picks, force-complete
- **CSV export** + printable results page at draft completion
- **Session-based auth** via short team passcodes (no OAuth, no email)

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase (Postgres + Realtime)
- Signed-cookie sessions via HMAC-SHA256 (`lib/auth.ts`)

## Setup

### 1. Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project. Name it whatever.
2. Once the project is ready, open **SQL Editor** → New Query → paste the contents of [`supabase/schema.sql`](supabase/schema.sql) → Run.
3. Open **Project Settings → API** and copy:
   - Project URL
   - `anon` public (or `publishable`) key
   - `service_role` secret key

> **Incremental migrations** live in [`supabase/migrations/`](supabase/migrations/) if you want the evolution history. For a fresh setup, `schema.sql` is all you need.

### 2. Environment variables

Copy `.env.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_ANON_KEY=…
SUPABASE_SERVICE_ROLE_KEY=…
SESSION_SECRET=…
```

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Using the app

### First-time setup (commissioner)

1. Go to `/commissioner/login`. Click **Start a new draft**.
2. Configure draft settings: name, year, salary cap, pick timer, mode, commissioner passcode.
3. Add teams in draft order. Each team gets a short passcode captains use to log in.
4. Click **Create draft** → lands on **Draft Settings** (you can still edit anything).
5. Click the **Players** tab. Either:
   - Paste a CSV/TSV of real players (headers: `first_name, last_name, position, points`, optional `gender`, `package`), or
   - Use the "Generate test players" section to seed random demo data.
6. Back to the main commissioner page — click **Start draft** when ready.

### Draft night flow

1. Share the site URL with every captain + anyone watching.
2. Captains enter their team passcode → they land on the live board.
3. Commissioner starts the draft → pick #1 is on the clock with a live timer.
4. On-the-clock team taps a player → confirms → pick syncs to every phone.
5. Commissioner can pick for any team (labeled **Pick for {team name}**) and undo the last pick.
6. When complete: a results modal opens for every team with their roster. Commissioner gets CSV downloads + a printable `/draft/results` page.

### Packages (optional)

If two or more players only play together, tag them with the same `package` value in the CSV (e.g. `sullivans`). When any one of them is picked, the others are **claimed** for that team — they disappear from the board and sit in a "claimed" section of the team's roster. On that team's next pick, the commissioner sees a prompt to either assign a claim to this round or let the team pick something else.

## Architecture notes

- **Realtime sync**: every client subscribes to `drafts`, `picks`, `players`, `packages` via Supabase Realtime. When the server confirms a mutation, all clients update within ~1s.
- **Pick validation**: server-side in [`app/api/pick/route.ts`](app/api/pick/route.ts). Checks turn ownership, draft status, player availability, salary cap.
- **Snake math**: [`lib/draft-logic.ts`](lib/draft-logic.ts) — `teamForPick(n, teams, mode)`.
- **Sessions**: signed cookies (HMAC-SHA256), 12-hour expiry. No Supabase Auth — the barrier to entry is knowing the team passcode.
- **Row-level security**: reads are public on shared draft state. All mutations go through server routes with the service-role client. `team_starred_players` has no read policy (default deny).

## Known limitations

- No rate limiting on passcode endpoints — fine for a one-night draft, add a limiter if you deploy long-lived.
- No in-app trade / roster-swap tool. If something goes wrong mid-draft, undo repeatedly or edit directly in Supabase.
- No mobile app — pure web. Works great on phones.
- Once the draft is `active`, player data is locked. Fixes require undo or Supabase editing.

## License

MIT. Use, fork, modify, whatever.

---

Built with [Claude Code](https://www.anthropic.com/claude-code).
