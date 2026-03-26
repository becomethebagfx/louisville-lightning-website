-- Scout observations: append-only table for live game scouting
-- Each row = one observation from a coach (e.g., "player #24 hit a ground ball to SS")
-- Multi-coach safe: independent INSERTs, no updates needed

create table if not exists scout_observations (
  id uuid default gen_random_uuid() primary key,
  team_name text not null,
  player_number text not null,
  player_name text,
  hit_type text check (hit_type in ('ground_ball', 'fly_ball', 'pop_fly', 'line_drive')),
  result text check (result in ('hit', 'out', 'strikeout', 'walk', 'error', 'hbp')),
  location_x real check (location_x >= 0 and location_x <= 100),
  location_y real check (location_y >= 0 and location_y <= 100),
  notes text,
  coach_name text,
  created_at timestamptz default now() not null
);

-- Index for fast lookups by team
create index if not exists idx_scout_obs_team on scout_observations (team_name);

-- Index for fast lookups by team + player
create index if not exists idx_scout_obs_team_player on scout_observations (team_name, player_number);

-- RLS: allow anyone with anon key to read and insert (coach PIN protects at app level)
alter table scout_observations enable row level security;

create policy "Allow public read" on scout_observations
  for select using (true);

create policy "Allow public insert" on scout_observations
  for insert with check (true);

-- Enable realtime for this table
alter publication supabase_realtime add table scout_observations;
