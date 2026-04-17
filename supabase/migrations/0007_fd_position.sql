-- Allow players to be listed as a combined forward/defense position.
alter table players drop constraint if exists players_position_check;
alter table players
  add constraint players_position_check
  check (position in ('F', 'D', 'G', 'FD'));
