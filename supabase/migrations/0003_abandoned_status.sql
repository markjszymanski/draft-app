-- Allow drafts to be marked as abandoned (started or set up but not played out).
alter table drafts drop constraint if exists drafts_status_check;
alter table drafts
  add constraint drafts_status_check
  check (status in ('setup', 'active', 'paused', 'complete', 'abandoned'));
