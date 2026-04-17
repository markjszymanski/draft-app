-- Replace the unused pick_queue table with a clean team_starred_players table.
-- A row means: this team has starred (favorited) this player.
-- One row per (team, player). No ordering — just a flat set.

drop table if exists pick_queue;

create table team_starred_players (
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, player_id)
);
create index team_starred_players_team_idx on team_starred_players(team_id);

alter table team_starred_players enable row level security;
-- All star reads/writes go through server routes with the service role,
-- so no public policies. Default deny is correct.
