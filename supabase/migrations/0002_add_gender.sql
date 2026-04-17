-- Add gender to players. Run this against your existing draft DB.
alter table players
  add column if not exists gender text not null default 'M'
  check (gender in ('M', 'F'));
