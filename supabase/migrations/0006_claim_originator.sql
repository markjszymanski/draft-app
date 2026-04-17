-- Track which pick triggered a player's claim, so undo can distinguish
-- "undo the originating pick" (clear all claims in the package) from
-- "undo a claim fulfillment" (restore the claim on the undone player).
alter table players
  add column if not exists claim_originator_pick_id uuid references picks(id) on delete set null;
create index if not exists players_claim_originator_idx on players(claim_originator_pick_id);
