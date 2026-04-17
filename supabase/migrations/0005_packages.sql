-- Player packages: groups of players who must be drafted together.
-- A player belongs to 0 or 1 package. When any package member is drafted,
-- the others are marked `reserved_for_team_id` so other teams know not to pick
-- them (the commissioner sorts out the actual picks at the table).

create table packages (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  label text,
  created_at timestamptz not null default now()
);
create index packages_draft_idx on packages(draft_id);

alter table players
  add column package_id uuid references packages(id) on delete set null,
  add column reserved_for_team_id uuid references teams(id) on delete set null;

create index players_package_idx on players(package_id);
create index players_reserved_idx on players(reserved_for_team_id);

alter table packages enable row level security;
create policy packages_read on packages for select using (true);

-- Make sure realtime sees package + reservation changes too.
alter table packages replica identity full;
