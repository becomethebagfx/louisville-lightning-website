-- ============================================================
-- RAFFLE HARDENING
-- Four adversarial reviewers took the ledger apart. This closes
-- what they found. Every change here exists because a specific
-- attack worked against the first cut.
-- ============================================================

-- ------------------------------------------------------------
-- 1. THE COMMITMENT MUST PRECEDE THE RANDOMNESS
--
-- The original design named the Kentucky Pick 3 MIDDAY drawing as
-- the seed and set the draw for 7:00pm the same day. Nothing
-- required the entry list to be frozen first. That left roughly six
-- hours in which the winning number was already public while the
-- coach still held unverified entries he could add to the pool in
-- any order. A raffle whose operator can see the answer before
-- sealing the questions is not provably fair, no matter how good
-- the hash is.
--
-- seed_available_at records the instant the named drawing publishes.
-- The freeze must happen strictly before it, and the draw must
-- confirm that it did.
-- ------------------------------------------------------------
alter table raffle_draws
  add column if not exists seed_available_at timestamptz;

update raffle_draws
   set seed_available_at = '2026-10-01T17:20:00Z'  -- Pick 3 midday, 1:20pm ET
 where id = 'glove-2026-10-01'
   and seed_available_at is null;

alter table raffle_draws
  alter column seed_available_at set not null;

-- Entries close 11:59pm ET Sep 30, the freeze happens that night or
-- the following morning, and the seed does not exist until 1:20pm
-- ET on Oct 1. The order is now enforced, not merely intended.
alter table raffle_draws
  drop constraint if exists raffle_seed_after_close;
alter table raffle_draws
  add constraint raffle_seed_after_close
  check (seed_available_at > entries_close_at);

-- ------------------------------------------------------------
-- 2. VERIFY CANNOT MINT TICKETS INTO A CLOSED POOL
--
-- raffle_verify_entry was the one privileged function with no
-- status guard, and it is the one that mints ticket numbers. The
-- only thing stopping a post-freeze verify was a check in the
-- caller. Invariants belong in the function that enforces them.
-- ------------------------------------------------------------
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
  v_draw_id     text;
  v_chances     integer;
  v_status      text;
  v_draw_status text;
  v_next        integer;
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

  -- Serialise on the draw row AND read its status under the same
  -- lock. A concurrent raffle_freeze now blocks here rather than
  -- slipping a ticket past the snapshot it is about to hash.
  select status into v_draw_status
    from raffle_draws where id = v_draw_id for update;

  if v_draw_status <> 'open' then
    raise exception
      'draw % is % and can no longer issue tickets', v_draw_id, v_draw_status;
  end if;

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

-- ------------------------------------------------------------
-- 3. THE FINGERPRINT MUST BE UNAMBIGUOUS AND MUST COVER THE DIVISOR
--
-- Two separate holes in the original preimage:
--
--   a) display_name is client supplied and was validated only for
--      length. Postgres trim() strips spaces, not newlines, so a
--      name of E'A\n5|9|Fake Z.' is 13 characters, passes the check,
--      and injects two attacker-authored pseudo-rows into the
--      canonical string once verified. The published hash then no
--      longer uniquely commits to the real list. Fixed at the door
--      in section 4 below, and defensively here.
--
--   b) The preimage covered the names and ranges but NOT
--      frozen_ticket_count, which is the divisor that produces the
--      winner, and not seed_source, which is where the randomness
--      comes from. An auditor could re-hash the board, match, and
--      still not have verified the two inputs that decide the
--      outcome.
--
-- The preimage is now versioned and carries draw_id, ticket count
-- and seed source. Bumping to v1 deliberately changes every hash,
-- which is safe: no draw has been frozen yet.
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
  -- Take the draw row lock FIRST, before reading any entry. The
  -- original computed its aggregate and then updated, with no lock
  -- in between: a verify committing inside that window landed on
  -- the public board but outside the published fingerprint.
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

  -- Defence in depth: even though the insert policy now rejects
  -- these characters, refuse to hash a list that contains them
  -- rather than publishing an ambiguous commitment.
  if v_canonical ~ '[|][^0-9]' and v_canonical ~ '[\r]' then
    raise exception 'refusing to freeze: a display name contains a delimiter character';
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

-- ------------------------------------------------------------
-- 4. THE DRAW MUST USE THE SEED IT PROMISED
--
-- raffle_execute_draw overwrote seed_source with whatever the
-- caller passed, so the pre-published source was destroyed at draw
-- time with no history. The source is now part of the commitment
-- and a mismatch is refused. The draw also confirms the freeze
-- happened before the seed existed, so the ordering guarantee
-- survives even if section 1's clock check were somehow bypassed.
-- ------------------------------------------------------------
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
  v_count       integer;
  v_hash        text;
  v_seed_source text;
  v_seed_at     timestamptz;
  v_frozen_at   timestamptz;
  v_digest      text;
  v_winner      integer;
begin
  select frozen_ticket_count, frozen_list_sha256, seed_source,
         seed_available_at, frozen_at
    into v_count, v_hash, v_seed_source, v_seed_at, v_frozen_at
    from raffle_draws
   where id = p_draw_id and status = 'frozen'
     for update;

  if not found then
    raise exception 'draw % must be frozen before it can be drawn', p_draw_id;
  end if;

  if trim(p_seed_source) is distinct from trim(v_seed_source) then
    raise exception
      'seed source mismatch: this draw committed to "%" and cannot be drawn from "%"',
      v_seed_source, p_seed_source;
  end if;

  if v_frozen_at >= v_seed_at then
    raise exception
      'draw % was frozen at %, after its seed published at %. Refusing to draw.',
      p_draw_id, v_frozen_at, v_seed_at;
  end if;

  if now() < v_seed_at then
    raise exception
      'the seed for draw % does not publish until %. Refusing to draw early.',
      p_draw_id, v_seed_at;
  end if;

  if length(trim(p_seed_value)) = 0 then
    raise exception 'seed value is required';
  end if;

  -- winner = 1 + (first 12 hex of sha256(seed) as integer  mod  ticket_count)
  v_digest := encode(extensions.digest(trim(p_seed_value), 'sha256'), 'hex');
  v_winner := 1 + (('x' || substr(v_digest, 1, 12))::bit(48)::bigint % v_count);

  update raffle_draws
     set status         = 'drawn',
         drawn_at       = now(),
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

-- ------------------------------------------------------------
-- 5. REJECT DELIMITER AND CONTROL CHARACTERS AT THE DOOR
--
-- The real fix for the preimage injection: a display name that can
-- contain a newline or a pipe can forge rows in the canonical
-- string. Names do not contain those characters.
-- ------------------------------------------------------------
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
    -- no pipes, no newlines, no control characters, no angle brackets
    and display_name !~ '[|<>[:cntrl:]]'
    and full_name    !~ '[[:cntrl:]]'
  );

-- Re-grant, because dropping and recreating the policy does not touch
-- grants but it is cheap to be explicit about the surface.
grant insert (
  draw_id, receipt_code, full_name, display_name,
  phone, email, chances, amount_cents, venmo_handle, note
) on raffle_entries to anon, authenticated;

revoke execute on function raffle_verify_entry(uuid, text)        from anon, authenticated, public;
revoke execute on function raffle_freeze(text)                    from anon, authenticated, public;
revoke execute on function raffle_execute_draw(text, text, text)  from anon, authenticated, public;
grant  execute on function raffle_verify_entry(uuid, text)        to service_role;
grant  execute on function raffle_freeze(text)                    to service_role;
grant  execute on function raffle_execute_draw(text, text, text)  to service_role;
