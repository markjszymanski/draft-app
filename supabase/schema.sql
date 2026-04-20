-- Ball Hockey Draft — full schema in one file.
-- Paste into the Supabase SQL Editor to provision a new project.
-- For the incremental history, see supabase/migrations/.

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
  status text not null default 'setup'
    check (status in ('setup', 'active', 'paused', 'complete', 'abandoned')),
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
  -- Canonical captain reference. The captain is also a row in `players`.
  captain_player_id uuid,
  draft_position int not null,
  passcode text not null,
  created_at timestamptz not null default now(),
  unique (draft_id, draft_position),
  unique (draft_id, passcode)
);

-- A package is a group of players who must be drafted together.
-- Drafting any one member claims (reserves) the rest for that team.
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
  -- F/D = hybrid forward-defenseman slot (treated as its own position).
  position text not null check (position in ('F', 'D', 'G', 'FD')),
  gender text not null default 'M' check (gender in ('M', 'F')),
  point_value int not null,
  drafted_by_team_id uuid references teams(id) on delete set null,
  reserved_for_team_id uuid references teams(id) on delete set null,
  package_id uuid references packages(id) on delete set null,
  -- claim_originator_pick_id FK is added below, after picks exists
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

-- Link players to the pick that triggered their package claim. Lets the undo
-- endpoint tell "undo the originator" from "undo a claim fulfillment".
alter table players
  add column claim_originator_pick_id uuid references picks(id) on delete set null;
create index players_claim_originator_idx on players(claim_originator_pick_id);

-- Captain FK (forward reference from teams → players).
alter table teams
  add constraint teams_captain_player_fk
  foreign key (captain_player_id) references players(id) on delete set null;
create index teams_captain_player_idx on teams(captain_player_id);
create unique index teams_captain_unique_per_draft
  on teams(draft_id, captain_player_id)
  where captain_player_id is not null;

-- Team-private favorites (stars) on players.
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

-- REPLICA IDENTITY FULL so UPDATE/DELETE payloads include the full row.
-- Required for undo + package-claim changes to propagate correctly to clients.
alter table drafts replica identity full;
alter table picks replica identity full;
alter table players replica identity full;
alter table teams replica identity full;
alter table packages replica identity full;

-- ============================================================================
-- ROW LEVEL SECURITY
-- All mutations go through server API routes using the service-role key
-- (bypasses RLS). These policies govern anon/authenticated reads only.
-- team_starred_players has no read policy = denied by default.
-- ============================================================================

alter table drafts enable row level security;
alter table teams enable row level security;
alter table players enable row level security;
alter table picks enable row level security;
alter table packages enable row level security;
alter table team_starred_players enable row level security;

create policy drafts_read on drafts for select using (true);
create policy teams_read on teams for select using (true);
create policy players_read on players for select using (true);
create policy picks_read on picks for select using (true);
create policy packages_read on packages for select using (true);
