-- Captains are now real players from the pool. captain_name kept for back-compat
-- display, but captain_player_id is the source of truth.
alter table teams
  add column if not exists captain_player_id uuid references players(id) on delete set null;
create index if not exists teams_captain_player_idx on teams(captain_player_id);

-- One player can only be captain of one team in a given draft.
create unique index if not exists teams_captain_unique_per_draft
  on teams(draft_id, captain_player_id)
  where captain_player_id is not null;
