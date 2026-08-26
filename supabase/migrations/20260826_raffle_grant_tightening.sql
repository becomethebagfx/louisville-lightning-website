-- ============================================================
-- RAFFLE GRANT TIGHTENING
-- Two findings from the wiring audit. Neither is exploitable
-- today, and both are the kind of thing that becomes exploitable
-- the moment somebody changes something nearby.
-- ============================================================

-- ------------------------------------------------------------
-- 1. raffle_board was granted ALL to anon, not SELECT
--
-- The original migration says `grant select on raffle_board to
-- anon, authenticated`, and that is true as far as it goes. What
-- it misses is that Supabase's DEFAULT PRIVILEGES had already
-- granted ALL on the new view, so the grant was additive and the
-- view sat there with INSERT, UPDATE, DELETE and TRUNCATE handed
-- to anon.
--
-- raffle_board is a simple view over raffle_entries and is
-- therefore auto-updatable, so those grants are real verbs, not
-- decoration. They are inert ONLY because the view carries
-- security_invoker = true, which makes writes execute as the
-- caller, and anon holds no write grant on the base table. Proved
-- with three live anon requests: INSERT, UPDATE and DELETE through
-- the view all return 42501 permission denied for raffle_entries.
--
-- So the lock that holds is the base table's. This view is a
-- second door that happens to open onto a wall. Take the grants
-- away so it is not a door at all: if anyone ever flips
-- security_invoker off, or grants anon a write on raffle_entries
-- for some unrelated reason, this view would silently become a
-- way to edit the ticket board.
-- ------------------------------------------------------------
revoke all on raffle_board from anon, authenticated;
grant select on raffle_board to anon, authenticated;

-- ------------------------------------------------------------
-- 2. The freeze delimiter backstop was a dead branch
--
-- The guard was written as:
--     if v_canonical ~ '[|][^0-9]' and v_canonical ~ '[\r]'
-- which is wrong twice over. `and` should be `or`, so a string
-- had to contain BOTH a pipe and a carriage return to trip it.
-- And the second pattern only looks for a carriage return, while
-- the actual attack in the finding used a NEWLINE. The branch
-- could not fire on the exact input its own comment described.
--
-- This never mattered in practice: the real defence is the insert
-- policy, which rejects `[|<>[:cntrl:]]` in display_name at the
-- door and is proven to do so by four live anon probes. But a
-- backstop that cannot fire is worse than no backstop, because
-- the comment above it tells the next reader they are covered.
--
-- Rewritten to test the thing it claims to test, on the same
-- character class the insert policy uses.
-- ------------------------------------------------------------
create or replace function raffle_freeze(p_draw_id text)
returns table (list_sha256 text, ticket_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_canonical   text;
  v_preimage    text;
  v_hash        text;
  v_count       integer;
  v_status      text;
  v_seed_source text;
  v_seed_at     timestamptz;
begin
  -- Lock the draw row FIRST, before reading any entry, so a verify
  -- committing concurrently cannot land on the public board but
  -- outside the fingerprint we are about to publish.
  select status, seed_source, seed_available_at
    into v_status, v_seed_source, v_seed_at
    from raffle_draws where id = p_draw_id for update;

  if not found then
    raise exception 'draw % does not exist', p_draw_id;
  end if;
  if v_status <> 'open' then
    raise exception 'draw % is % and cannot be frozen again', p_draw_id, v_status;
  end if;
  if now() >= v_seed_at then
    raise exception
      'refusing to freeze draw %: its seed (%) published at % and is already public. '
      'Sealing the list after the winning number exists would make the draw unprovable.',
      p_draw_id, v_seed_source, v_seed_at;
  end if;

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

  -- Backstop. The insert policy already rejects these characters in
  -- display_name; this refuses to publish an ambiguous commitment if
  -- one ever reaches the table by another route. A display name
  -- containing a pipe, an angle bracket or any control character
  -- could forge extra rows in the preimage below.
  if exists (
    select 1 from raffle_entries e
     where e.draw_id = p_draw_id
       and e.status = 'verified'
       and e.display_name ~ '[|<>[:cntrl:]]'
  ) then
    raise exception
      'refusing to freeze draw %: a verified display name contains a delimiter '
      'or control character, which would make the published fingerprint ambiguous.',
      p_draw_id;
  end if;

  v_preimage := 'lightning-raffle/v1' || E'\n'
             || p_draw_id             || E'\n'
             || v_count               || E'\n'
             || coalesce(v_seed_source, '') || E'\n'
             || v_canonical;

  v_hash := encode(extensions.digest(v_preimage, 'sha256'), 'hex');

  update raffle_draws
     set status              = 'frozen',
         frozen_at           = now(),
         frozen_list_sha256  = v_hash,
         frozen_ticket_count = v_count
   where id = p_draw_id;

  return query select v_hash, v_count;
end;
$$;

revoke execute on function raffle_freeze(text) from anon, authenticated, public;
grant  execute on function raffle_freeze(text) to service_role;

-- ------------------------------------------------------------
-- 3. The seeded title in the first migration is stale
--
-- The live row's title now names the size and model, but the seed
-- INSERT in 20260825_create_raffle.sql still carries the original
-- string and can never correct itself because of its
-- `on conflict (id) do nothing`. Re-assert it here so a rebuild
-- from migrations produces what production actually has.
-- ------------------------------------------------------------
update raffle_draws
   set title = 'Rawlings Heart of the Hide R2G 11.5 inch (PROR204U-4CM) Glove Raffle'
 where id = 'glove-2026-10-01';
