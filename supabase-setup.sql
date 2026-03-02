-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Players table
create table if not exists players (
  id text primary key,
  name text not null,
  number text not null default '?',
  song_name text not null default '',
  start_time real,
  clip_duration real,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security (public read/write for simplicity)
alter table players enable row level security;

create policy "Anyone can read players"
  on players for select using (true);

create policy "Anyone can insert players"
  on players for insert with check (true);

create policy "Anyone can update players"
  on players for update using (true);

create policy "Anyone can delete players"
  on players for delete using (true);

-- Storage bucket for audio clips
insert into storage.buckets (id, name, public)
  values ('walkup-audio', 'walkup-audio', true)
  on conflict (id) do nothing;

-- Storage policies (public read, anyone can upload/delete)
create policy "Anyone can read audio"
  on storage.objects for select
  using (bucket_id = 'walkup-audio');

create policy "Anyone can upload audio"
  on storage.objects for insert
  with check (bucket_id = 'walkup-audio');

create policy "Anyone can update audio"
  on storage.objects for update
  using (bucket_id = 'walkup-audio');

create policy "Anyone can delete audio"
  on storage.objects for delete
  using (bucket_id = 'walkup-audio');

-- Seed the roster with Louisville Lightning players
insert into players (id, name, number, song_name, sort_order) values
  ('player-kask-k', 'Kask K', '?', '', 0),
  ('player-kash-d', 'Kash D', '?', '', 1),
  ('player-reid', 'Reid', '?', '', 2),
  ('player-elijah', 'Elijah', '25', '', 3),
  ('player-micah', 'Micah', '?', '', 4),
  ('player-colt', 'Colt', '?', '', 5),
  ('player-beau', 'Beau', '?', '', 6),
  ('player-mason', 'Mason', '?', '', 7),
  ('player-grayson', 'Grayson', '?', '', 8),
  ('player-cooper', 'Cooper', '?', '', 9),
  ('player-grant', 'Grant', '?', '', 10)
on conflict (id) do nothing;
