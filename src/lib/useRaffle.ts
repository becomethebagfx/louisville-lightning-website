/* ============================================================
   RAFFLE DATA LAYER
   The only module that talks to Supabase about the raffle.
   Every raffle component consumes these hooks and NEVER calls
   supabase.from('raffle_*') directly - that is what keeps the
   private columns out of reach of a careless select.
   ============================================================ */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import {
  DRAW_ID,
  ticketsToCents,
  toDisplayName,
  generateReceiptCode,
  type RaffleBoardRow,
  type RaffleDraw,
  type RaffleReceipt,
} from './raffleData';

export interface RaffleStats {
  verified_entries: number;
  pending_entries: number;
  total_tickets: number;
  raised_cents: number;
}

const EMPTY_STATS: RaffleStats = {
  verified_entries: 0,
  pending_entries: 0,
  total_tickets: 0,
  raised_cents: 0,
};

const NO_DB =
  'The raffle database is not reachable right now. Text Coach Aaron and he will get you entered by hand.';

/* ------------------------------------------------------------
   The draw itself: status, dates, and (after the drawing) the
   published hash and the winning number.
   ------------------------------------------------------------ */
export function useRaffleDraw() {
  const [draw, setDraw] = useState<RaffleDraw | null>(null);
  /* Seeded from whether a client exists at all, so the no-client path does not
     have to call setState synchronously inside the effect. */
  const [loading, setLoading] = useState(() => Boolean(supabase));

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('raffle_draws')
      .select('*')
      .eq('id', DRAW_ID)
      .maybeSingle();
    setDraw((data as RaffleDraw) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    /* Deferred a tick so the first fetch never resolves synchronously inside
       the effect (Supabase can answer from cache) and cascade a render. */
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);

  return { draw, loading, refresh };
}

/* ------------------------------------------------------------
   The public board. Verified entries only - RLS guarantees it,
   this hook does not have to.
   ------------------------------------------------------------ */
export function useRaffleBoard(pollMs = 0) {
  const [rows, setRows] = useState<RaffleBoardRow[]>([]);
  const [stats, setStats] = useState<RaffleStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(() => Boolean(supabase));
  /* A failed fetch and an empty board are NOT the same thing. On the winner
     announcement an empty board renders a number with no name beside it,
     which reads as the team refusing to say who won. Callers need to be able
     to tell the two apart. */
  const [error, setError] = useState(() => !supabase);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [board, statsRes] = await Promise.all([
      supabase
        .from('raffle_board')
        .select('display_name,chances,ticket_start,ticket_end,created_at')
        .eq('draw_id', DRAW_ID)
        .order('ticket_start', { ascending: true }),
      supabase.rpc('raffle_stats', { p_draw_id: DRAW_ID }),
    ]);

    if (board.error) {
      setError(true);
    } else {
      setError(false);
      setRows((board.data ?? []) as RaffleBoardRow[]);
    }
    const s = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
    if (s) setStats(s as RaffleStats);
    setLoading(false);
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const id = pollMs ? setInterval(() => void refresh(), pollMs) : undefined;
    return () => {
      clearTimeout(first);
      if (id) clearInterval(id);
    };
  }, [refresh, pollMs]);

  return { rows, stats, loading, error, refresh };
}

/* ------------------------------------------------------------
   Submitting an entry. Returns the receipt code on success so the
   entrant has something to screenshot immediately, before Aaron
   has confirmed anything.
   ------------------------------------------------------------ */
export interface SubmitEntryArgs {
  fullName: string;
  phone: string;
  email: string;
  chances: number;
  venmoHandle: string;
  note: string;
}

export type SubmitResult =
  | { ok: true; receiptCode: string; displayName: string }
  | { ok: false; error: string };

export async function submitRaffleEntry(args: SubmitEntryArgs): Promise<SubmitResult> {
  if (!supabase) return { ok: false, error: NO_DB };

  const fullName = args.fullName.trim();
  const chances = Math.floor(args.chances);

  // These bounds mirror the RLS insert policy exactly. Anything the policy
  // refuses must be caught here with a message that names the real problem,
  // because a policy rejection surfaces as "entries are closed" below and
  // sending someone to text the coach about a deadline that has not passed
  // is worse than no validation at all.
  if (fullName.length < 2) return { ok: false, error: 'Enter your first and last name.' };
  if (fullName.length > 80)
    return { ok: false, error: 'That name is too long for the entry form. Try a shorter version of it.' };
  if (!Number.isFinite(chances) || chances < 1)
    return { ok: false, error: 'Choose at least one ticket.' };
  if (chances > 100)
    return { ok: false, error: 'Maximum 100 tickets in a single entry. Send anything larger as a second entry.' };
  if (args.phone.replace(/\D/g, '').length < 10)
    return { ok: false, error: 'Enter a phone number so we can reach you if you win.' };

  const receiptCode = generateReceiptCode();
  const displayName = toDisplayName(fullName);
  if (displayName.length > 40)
    return { ok: false, error: 'That name is too long for the entry form. Try a shorter version of it.' };

  const { error } = await supabase.from('raffle_entries').insert({
    draw_id: DRAW_ID,
    receipt_code: receiptCode,
    full_name: fullName,
    display_name: displayName,
    phone: args.phone.trim(),
    email: args.email.trim(),
    chances,
    amount_cents: ticketsToCents(chances),
    venmo_handle: args.venmoHandle.trim(),
    note: args.note.trim().slice(0, 280),
  });

  if (error) {
    // The RLS predicate is the gate that closes entries at the deadline,
    // so a policy violation here almost always means "too late".
    if (error.message.includes('row-level security')) {
      // Do not assert a cause we have not checked. Ask the draw whether it is
      // actually closed before telling someone their money is too late.
      const { data: draw } = await supabase
        .from('raffle_draws')
        .select('status,entries_close_at')
        .eq('id', DRAW_ID)
        .maybeSingle();
      const reallyClosed =
        !draw || draw.status !== 'open' || new Date(draw.entries_close_at).getTime() <= Date.now();
      return {
        ok: false,
        error: reallyClosed
          ? 'Entries for this raffle are closed. Text Coach Aaron if you think that is wrong.'
          : 'Something in that entry was rejected. Check the name and the number of tickets, then try again, or text Coach Aaron.',
      };
    }
    if (error.code === '23505')
      return { ok: false, error: 'That entry was already submitted. Check your receipt code below.' };
    return { ok: false, error: 'Could not submit that entry. Try again, or text Coach Aaron.' };
  }

  return { ok: true, receiptCode, displayName };
}

/* ------------------------------------------------------------
   Receipt lookup. Goes through the security-definer RPC, which
   returns one row and only the fields that entrant already knows.
   ------------------------------------------------------------ */
export async function lookupReceipt(
  code: string,
): Promise<{ ok: true; receipt: RaffleReceipt | null } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: NO_DB };
  const clean = code.trim().toUpperCase();
  if (clean.length < 4) return { ok: false, error: 'Enter your full receipt code.' };

  const { data, error } = await supabase.rpc('raffle_receipt', { p_code: clean });
  if (error) return { ok: false, error: 'Could not look that code up. Try again in a moment.' };

  const row = Array.isArray(data) ? data[0] : data;
  return { ok: true, receipt: (row as RaffleReceipt) ?? null };
}

/* ------------------------------------------------------------
   Countdown. Returns null once the target has passed so callers
   can swap the whole block out rather than render a frozen zero.
   ------------------------------------------------------------ */
export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function useCountdown(isoTarget: string): Countdown | null {
  const compute = useCallback((): Countdown | null => {
    const ms = new Date(isoTarget).getTime() - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return {
      days: Math.floor(ms / 86_400_000),
      hours: Math.floor(ms / 3_600_000) % 24,
      minutes: Math.floor(ms / 60_000) % 60,
      seconds: Math.floor(ms / 1000) % 60,
    };
  }, [isoTarget]);

  const [left, setLeft] = useState<Countdown | null>(compute);

  useEffect(() => {
    const tick = () => setLeft(compute());
    /* The lazy initializer above already covers mount. This resyncs when the
       target changes, deferred by a tick so the effect never sets state
       synchronously and cascades a second render. */
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [compute]);

  return left;
}
