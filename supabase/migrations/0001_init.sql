-- Ball Hockey Draft App schema
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

create table drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  salary_cap int not null default 10000,
  pick_timer_seconds int not null default 120,
  draft_mode text not null default 'snake' check (draft_mode in ('linear', 'snake')),
  status text not null default 'setup' check (status in ('setup', 'active', 'paused', 'complete', 'abandoned')),
  roster_size int not null default 15,
  current_pick_number int not null default 1,
  current_pick_started_at timestamptz,
  commissioner_passcode text not null,
  created_at timestamptz not null default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  name text not null,
  captain_name text,
  draft_position int not null,
  passcode text not null,
  created_at timestamptz not null default now(),
  unique (draft_id, draft_position),
  unique (draft_id, passcode)
);

create table packages (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
create index packages_draft_idx on packages(draft_id);

create table players (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  position text not null check (position in ('F', 'D', 'G', 'FD')),
  gender text not null default 'M' check (gender in ('M', 'F')),
  point_value int not null,
  drafted_by_team_id uuid references teams(id) on delete set null,
  reserved_for_team_id uuid references teams(id) on delete set null,
  package_id uuid references packages(id) on delete set null,
  -- claim_originator_pick_id added below after picks table is created
  created_at timestamptz not null default now()
);
create index players_draft_idx on players(draft_id);
create index players_drafted_idx on players(draft_id, drafted_by_team_id);
create index players_package_idx on players(package_id);
create index players_reserved_idx on players(reserved_for_team_id);

create table picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  pick_number int not null,
  round int not null,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  picked_at timestamptz not null default now(),
  picked_by text not null default 'team' check (picked_by in ('team', 'commissioner')),
  unique (draft_id, pick_number),
  unique (draft_id, player_id)
);
create index picks_draft_idx on picks(draft_id, pick_number);

-- Forward FK from players to picks: tracks the originating pick for a claim.
alter table players add column claim_originator_pick_id uuid references picks(id) on delete set null;
create index players_claim_originator_idx on players(claim_originator_pick_id);

-- A row means: this team has starred (favorited) this player.
create table team_starred_players (
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, player_id)
);
create index team_starred_players_team_idx on team_starred_players(team_id);

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table drafts;
alter publication supabase_realtime add table picks;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table packages;

-- REPLICA IDENTITY FULL ensures realtime UPDATE/DELETE payloads contain the full
-- row (not just the primary key). Required so undo events propagate the cleared
-- drafted_by_team_id to subscribers.
alter table drafts replica identity full;
alter table picks replica identity full;
alter table players replica identity full;
alter table teams replica identity full;
alter table packages replica identity full;

-- ============================================================================
-- ROW LEVEL SECURITY
-- All mutations go through server API routes using the service role key,
-- which bypasses RLS. These policies govern anon/authenticated reads only.
-- pick_queue is the one table the client reads with team scoping.
-- ============================================================================

alter table drafts enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table picks enable row level security;
alter table packages enable row level security;
alter table team_starred_players enable row level security;

-- Public read for shared draft state
create policy drafts_read on drafts for select using (true);
create policy teams_read on teams for select using (true);
create policy players_read on players for select using (true);
create policy picks_read on picks for select using (true);
create policy packages_read on packages for select using (true);

-- team_starred_players: no anon read. Server routes use service role to scope by team.
-- Default deny under RLS is correct.
