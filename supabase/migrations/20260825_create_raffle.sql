-- ============================================================
-- LOUISVILLE LIGHTNING - RAFFLE LEDGER
-- Mirrors src/lib/raffleData.ts. Change one, change the other.
--
-- SECURITY POSTURE (this is the whole point of the file):
-- The site is a static SPA. Its anon key ships inside the JS
-- bundle, so "anon" means "anyone on the internet, including
-- someone with devtools open". Therefore anon may:
--     * INSERT a pending entry, and nothing else
--     * SELECT a whitelist of columns, on verified rows only
--     * look up ONE entry by its own receipt code, via RPC
-- Everything that decides who wins - verify, freeze, draw -
-- requires service_role and runs in the raffle-admin edge
-- function. No client-side PIN gates anything that matters.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- draws
-- ------------------------------------------------------------
create table if not exists raffle_draws (
  id                  text primary key,
  title               text        not null,
  status              text        not null default 'open'
                        check (status in ('open', 'frozen', 'drawn')),
  entries_close_at    timestamptz not null,
  draw_at             timestamptz not null,

  -- the commitment: published BEFORE the draw so the entry list
  -- provably cannot be edited afterwards
  frozen_at           timestamptz,
  frozen_list_sha256  text,
  frozen_ticket_count integer,

  -- the draw itself
  drawn_at            timestamptz,
  seed_source         text,
  seed_value          text,
  winning_ticket      integer,
  draw_video_url      text,

  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- entries
-- ------------------------------------------------------------
create table if not exists raffle_entries (
  id            uuid primary key default gen_random_uuid(),
  draw_id       text not null references raffle_draws (id) on delete restrict,
  receipt_code  text not null unique,

  -- PRIVATE. Never granted to anon. Never selected by a public surface.
  full_name     text not null,
  phone         text not null default '',
  email         text not null default '',
  venmo_handle  text not null default '',
  note          text not null default '',

  -- PUBLIC, once verified.
  display_name  text not null,
  chances       integer not null check (chances between 1 and 100),
  amount_cents  integer not null check (amount_cents > 0),

  status        text not null default 'pending'
                  check (status in ('pending', 'verified', 'rejected')),
  ticket_start  integer,
  ticket_end    integer,
  verified_at   timestamptz,
  verified_by   text,
  reject_reason text,

  created_at    timestamptz not null default now(),

  -- $10 a chance, exactly. No partial entries, ever.
  constraint raffle_amount_matches_chances
    check (amount_cents = chances * 1000),

  -- a verified entry has a contiguous block sized to its chances;
  -- an unverified one has no tickets at all
  constraint raffle_tickets_match_status check (
    (status = 'verified'
      and ticket_start is not null
      and ticket_end   is not null
      and ticket_end - ticket_start + 1 = chances)
    or
    (status <> 'verified'
      and ticket_start is null
      and ticket_end   is null)
  )
);

create index if not exists raffle_entries_draw_status_idx
  on raffle_entries (draw_id, status);
create index if not exists raffle_entries_ticket_idx
  on raffle_entries (draw_id, ticket_start);

-- no two verified entries may ever claim the same ticket number
create unique index if not exists raffle_entries_ticket_start_uniq
  on raffle_entries (draw_id, ticket_start)
  where ticket_start is not null;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table raffle_draws   enable row level security;
alter table raffle_entries enable row level security;

-- Supabase grants broadly to anon/authenticated by default. Take it
-- all back first, then hand back exactly the columns that are safe.
revoke all on raffle_draws   from anon, authenticated;
revoke all on raffle_entries from anon, authenticated;

-- ---- draws: world-readable. Everything in this table is meant to
-- ---- be public, and publishing it early is what makes it credible.
grant select on raffle_draws to anon, authenticated;

drop policy if exists "raffle draws are public" on raffle_draws;
create policy "raffle draws are public"
  on raffle_draws for select
  to anon, authenticated
  using (true);

-- ---- entries: INSERT is the only write anon gets.
-- Column-level grant is the real lock: status, ticket_start,
-- ticket_end and verified_by are simply not insertable by anon, so
-- a hand-rolled POST cannot self-verify or mint its own tickets.
grant insert (
  draw_id, receipt_code, full_name, display_name,
  phone, email, chances, amount_cents, venmo_handle, note
) on raffle_entries to anon, authenticated;

drop policy if exists "anyone may enter an open raffle" on raffle_entries;
create policy "anyone may enter an open raffle"
  on raffle_entries for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from raffle_draws d
      where d.id = raffle_entries.draw_id
        and d.status = 'open'
        and now() < d.entries_close_at
    )
    and chances between 1 and 100
    and amount_cents = chances * 1000
    and length(trim(full_name))    between 2 and 80
    and length(trim(display_name)) between 1 and 40
    and length(coalesce(note, ''))  <= 280
  );

-- ---- entries: SELECT is a whitelist of columns on verified rows.
-- full_name / phone / email / venmo_handle / note are NOT in this
-- grant, so they cannot be read even by a crafted PostgREST query.
grant select (
  draw_id, display_name, chances, ticket_start, ticket_end, created_at
) on raffle_entries to anon, authenticated;

drop policy if exists "verified entries are public" on raffle_entries;
create policy "verified entries are public"
  on raffle_entries for select
  to anon, authenticated
  using (status = 'verified');

-- No UPDATE and no DELETE policy exists for anon by design. An entry,
-- once submitted, is append-only from the public's side.

-- ============================================================
-- PUBLIC READ SURFACES
-- ============================================================

-- The board everyone sees. security_invoker keeps the RLS predicate
-- above in force rather than quietly running as the view owner.
drop view if exists raffle_board;
create view raffle_board
  with (security_invoker = true) as
  select draw_id, display_name, chances, ticket_start, ticket_end, created_at
  from raffle_entries
  order by ticket_start;

grant select on raffle_board to anon, authenticated;

-- Aggregate counts, including how many are still awaiting Venmo
-- confirmation. Counts only: no pending NAMES are ever exposed.
create or replace function raffle_stats(p_draw_id text)
returns table (
  verified_entries integer,
  pending_entries  integer,
  total_tickets    integer,
  raised_cents     integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where status = 'verified')::int,
    count(*) filter (where status = 'pending')::int,
    coalesce(sum(chances) filter (where status = 'verified'), 0)::int,
    coalesce(sum(amount_cents) filter (where status = 'verified'), 0)::int
  from raffle_entries
  where draw_id = p_draw_id;
$$;

grant execute on function raffle_stats(text) to anon, authenticated;

-- One entrant checking their own entry. Returns at most one row and
-- only the fields that entrant already knows about themselves.
create or replace function raffle_receipt(p_code text)
returns table (
  status        text,
  display_name  text,
  chances       integer,
  ticket_start  integer,
  ticket_end    integer,
  reject_reason text
)
language sql
security definer
set search_path = public
stable
as $$
  select e.status, e.display_name, e.chances,
         e.ticket_start, e.ticket_end, e.reject_reason
  from raffle_entries e
  where upper(trim(e.receipt_code)) = upper(trim(p_code))
  limit 1;
$$;

grant execute on function raffle_receipt(text) to anon, authenticated;

-- ============================================================
-- PRIVILEGED OPERATIONS  (service_role only - the edge function)
-- ============================================================

-- Assign the next contiguous ticket block. The row lock on the draw
-- serialises concurrent verifications, so two entries can never be
-- handed the same number even if Aaron double-taps the button.
create or replace function raffle_verify_entry(
  p_entry_id uuid,
  p_verifier text
)
returns table (ticket_start integer, ticket_end integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draw_id  text;
  v_chances  integer;
  v_status   text;
  v_next     integer;
begin
  select draw_id, chances, status
    into v_draw_id, v_chances, v_status
    from raffle_entries where id = p_entry_id;

  if not found then
    raise exception 'entry % not found', p_entry_id;
  end if;
  if v_status = 'verified' then
    raise exception 'entry % is already verified', p_entry_id;
  end if;

  -- serialise on the draw row
  perform 1 from raffle_draws where id = v_draw_id for update;

  select coalesce(max(e.ticket_end), 0) + 1
    into v_next
    from raffle_entries e
   where e.draw_id = v_draw_id and e.ticket_end is not null;

  update raffle_entries
     set status        = 'verified',
         ticket_start  = v_next,
         ticket_end    = v_next + v_chances - 1,
         verified_at   = now(),
         verified_by   = p_verifier,
         reject_reason = null
   where id = p_entry_id;

  return query select v_next, v_next + v_chances - 1;
end;
$$;

-- Freeze the pool and publish its fingerprint. After this runs, any
-- edit to any verified entry changes the hash and is detectable by
-- anyone who saved the published list.
create or replace function raffle_freeze(p_draw_id text)
returns table (list_sha256 text, ticket_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical text;
  v_hash      text;
  v_count     integer;
begin
  select string_agg(
           e.ticket_start || '|' || e.ticket_end || '|' || e.display_name,
           E'\n' order by e.ticket_start
         ),
         coalesce(sum(e.chances), 0)
    into v_canonical, v_count
    from raffle_entries e
   where e.draw_id = p_draw_id and e.status = 'verified';

  if v_count = 0 then
    raise exception 'refusing to freeze draw % with zero verified entries', p_draw_id;
  end if;

  v_hash := encode(extensions.digest(coalesce(v_canonical, ''), 'sha256'), 'hex');

  update raffle_draws
     set status              = 'frozen',
         frozen_at           = now(),
         frozen_list_sha256  = v_hash,
         frozen_ticket_count = v_count
   where id = p_draw_id and status = 'open';

  if not found then
    raise exception 'draw % is not open and cannot be frozen', p_draw_id;
  end if;

  return query select v_hash, v_count;
end;
$$;

-- The draw. winning_ticket is a pure function of the public seed and
-- the frozen ticket count, so anyone can recompute it by hand.
--   winner = 1 + (sha256(seed) as integer  mod  ticket_count)
create or replace function raffle_execute_draw(
  p_draw_id     text,
  p_seed_source text,
  p_seed_value  text
)
returns table (winning_ticket integer, display_name text, list_sha256 text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count  integer;
  v_hash   text;
  v_digest text;
  v_winner integer;
begin
  select frozen_ticket_count, frozen_list_sha256
    into v_count, v_hash
    from raffle_draws
   where id = p_draw_id and status = 'frozen';

  if not found then
    raise exception 'draw % must be frozen before it can be drawn', p_draw_id;
  end if;

  -- first 12 hex chars of sha256(seed) -> integer -> modulo pool size
  v_digest := encode(extensions.digest(trim(p_seed_value), 'sha256'), 'hex');
  v_winner := 1 + (('x' || substr(v_digest, 1, 12))::bit(48)::bigint % v_count);

  update raffle_draws
     set status         = 'drawn',
         drawn_at       = now(),
         seed_source    = p_seed_source,
         seed_value     = trim(p_seed_value),
         winning_ticket = v_winner
   where id = p_draw_id;

  return query
    select v_winner,
           coalesce(
             (select e.display_name from raffle_entries e
               where e.draw_id = p_draw_id
                 and v_winner between e.ticket_start and e.ticket_end),
             'UNCLAIMED'),
           v_hash;
end;
$$;

-- These three decide who wins. Nobody but the edge function gets them.
revoke execute on function raffle_verify_entry(uuid, text)        from anon, authenticated, public;
revoke execute on function raffle_freeze(text)                    from anon, authenticated, public;
revoke execute on function raffle_execute_draw(text, text, text)  from anon, authenticated, public;
grant  execute on function raffle_verify_entry(uuid, text)        to service_role;
grant  execute on function raffle_freeze(text)                    to service_role;
grant  execute on function raffle_execute_draw(text, text, text)  to service_role;

-- ============================================================
-- SEED THE DRAW
-- ============================================================
insert into raffle_draws (id, title, entries_close_at, draw_at, seed_source)
values (
  'glove-2026-10-01',
  'Rawlings Heart of the Hide R2G Glove Raffle',
  '2026-10-01T03:59:00Z',   -- Sep 30, 11:59pm ET
  '2026-10-01T23:00:00Z',   -- Oct 1,  7:00pm ET
  'Kentucky Pick 3 MIDDAY drawing, October 1, 2026'
)
on conflict (id) do nothing;
