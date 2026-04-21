-- Server-side flag for "commissioner skipped claim resolution for this pick".
-- Previously tracked in client React state, which meant only the device that
-- clicked "skip" saw the modal close. Moving to a draft column so realtime
-- propagates the decision to every viewer.
alter table drafts
  add column if not exists claim_skipped_for_pick int;
