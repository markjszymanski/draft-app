export type Position = 'F' | 'D' | 'G' | 'FD';
export type Gender = 'M' | 'F';
export type DraftMode = 'linear' | 'snake';
export type DraftStatus = 'setup' | 'active' | 'paused' | 'complete' | 'abandoned';
export type PickedBy = 'team' | 'commissioner';

export type Draft = {
  id: string;
  name: string;
  year: number;
  salary_cap: number;
  pick_timer_seconds: number;
  draft_mode: DraftMode;
  status: DraftStatus;
  roster_size: number;
  current_pick_number: number;
  current_pick_started_at: string | null;
  commissioner_passcode: string;
  created_at: string;
};

export type Team = {
  id: string;
  draft_id: string;
  name: string;
  captain_name: string | null;
  draft_position: number;
  passcode: string;
  created_at: string;
};

export type Player = {
  id: string;
  draft_id: string;
  first_name: string;
  last_name: string;
  position: Position;
  gender: Gender;
  point_value: number;
  drafted_by_team_id: string | null;
  reserved_for_team_id: string | null;
  package_id: string | null;
  claim_originator_pick_id: string | null;
  created_at: string;
};

export type Package = {
  id: string;
  draft_id: string;
  label: string | null;
  created_at: string;
};

export type DraftPick = {
  id: string;
  draft_id: string;
  pick_number: number;
  round: number;
  team_id: string;
  player_id: string;
  picked_at: string;
  picked_by: PickedBy;
};

export type StarredPlayer = {
  team_id: string;
  player_id: string;
  created_at: string;
};
