/* ============================================================
   RAFFLE ADMIN CONSOLE  (the coach's console)
   ------------------------------------------------------------
   SECURITY POSTURE, stated plainly because it is the whole point:

   * This file ships in the public JS bundle. It therefore holds
     NO credential of any kind: no service key, no PIN, no admin
     token. The admin key arrives in the URL (?k=...), is captured
     into memory, and the query string is then scrubbed with
     history.replaceState so the key does not sit in the address
     bar or in browser history. Nothing is written to localStorage
     or sessionStorage either.
   * Every privileged operation is an HTTP POST to the raffle-admin
     edge function with the key in the x-raffle-key header. The
     function checks that key against a secret this bundle never
     sees, then calls the security-definer functions as
     service_role. This page cannot verify, freeze or draw on its
     own: the anon key it would have to use is not granted
     raffle_verify_entry, raffle_freeze or raffle_execute_draw.
   * No supabase.from('raffle_*') call appears here, for a privileged
     read or any other kind. Private columns (full_name, phone,
     email, venmo_handle, note) reach this page ONLY through the
     edge function response, and this page is not a public surface.
   * With no ?k= present, the console is not rendered and no request
     is fired.
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DRAW_ID,
  SEED_SOURCE_LABEL,
  VENMO,
  PRICE_PER_CHANCE_CENTS,
  DRAW_TIME_LABEL,
  ENTRIES_CLOSE_LABEL,
  formatUsd,
  formatTicketRange,
  type RaffleStatus,
  type DrawStatus,
} from '../lib/raffleData';

const ease = [0.16, 1, 0.3, 1] as const;

/* The project URL is public config, not a secret. It already ships in
   the bundle via src/lib/supabase.ts. */
const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
const ADMIN_ENDPOINT = `${SUPABASE_URL}/functions/v1/raffle-admin`;
/* Public by design: this ships in every visitor's bundle already and grants
   nothing on the raffle tables. It exists here only to clear the edge
   gateway's JWT check. It is NOT the admin credential. */
const ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');

/* ------------------------------------------------------------
   Tiny, total JSON readers. The edge function is owned by another
   lane, so every field is read defensively and nothing is cast.
   ------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(src: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return '';
}

function readNumber(src: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = src[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** Accepts a flat body or one that wraps its payload in data / result / payload. */
function payloadOf(body: Record<string, unknown>): Record<string, unknown> {
  for (const key of ['data', 'result', 'payload']) {
    const nested = body[key];
    if (isRecord(nested)) return { ...nested, ...body };
  }
  return body;
}

function readEntryStatus(src: Record<string, unknown>): RaffleStatus {
  const raw = readString(src, ['status']).toLowerCase();
  return raw === 'verified' || raw === 'rejected' ? raw : 'pending';
}

function readDrawStatus(src: Record<string, unknown>): DrawStatus | null {
  const raw = readString(src, ['status']).toLowerCase();
  return raw === 'open' || raw === 'frozen' || raw === 'drawn' ? raw : null;
}

/* ------------------------------------------------------------
   What the console works with. Private fields are present here
   because matching the Venmo feed is the job.
   ------------------------------------------------------------ */
interface AdminEntry {
  id: string;
  receiptCode: string;
  fullName: string;
  displayName: string;
  phone: string;
  email: string;
  venmoHandle: string;
  note: string;
  chances: number;
  amountCents: number;
  status: RaffleStatus;
  ticketStart: number | null;
  ticketEnd: number | null;
  rejectReason: string | null;
  createdAt: string;
}

function toAdminEntry(raw: unknown): AdminEntry | null {
  if (!isRecord(raw)) return null;
  const id = readString(raw, ['id', 'entry_id', 'entryId']);
  if (!id) return null;
  const chances = readNumber(raw, ['chances']) ?? 0;
  return {
    id,
    receiptCode: readString(raw, ['receipt_code', 'receiptCode']),
    fullName: readString(raw, ['full_name', 'fullName']),
    displayName: readString(raw, ['display_name', 'displayName']),
    phone: readString(raw, ['phone']),
    email: readString(raw, ['email']),
    venmoHandle: readString(raw, ['venmo_handle', 'venmoHandle']),
    note: readString(raw, ['note']),
    chances,
    amountCents:
      readNumber(raw, ['amount_cents', 'amountCents']) ?? chances * PRICE_PER_CHANCE_CENTS,
    status: readEntryStatus(raw),
    ticketStart: readNumber(raw, ['ticket_start', 'ticketStart']),
    ticketEnd: readNumber(raw, ['ticket_end', 'ticketEnd']),
    rejectReason: readString(raw, ['reject_reason', 'rejectReason']) || null,
    createdAt: readString(raw, ['created_at', 'createdAt']),
  };
}

/* ------------------------------------------------------------
   The one place a request leaves this page.
   ------------------------------------------------------------ */
type AdminResponse =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; unauthorized: boolean };

const BAD_KEY = 'That admin key is not valid.';

async function postAdmin(
  adminKey: string,
  action: string,
  payload: Record<string, unknown>,
): Promise<AdminResponse> {
  if (!SUPABASE_URL) {
    return {
      ok: false,
      unauthorized: false,
      error: 'This build has no raffle server configured, so nothing can be verified from here.',
    };
  }

  let res: Response;
  try {
    res = await fetch(ADMIN_ENDPOINT, {
      method: 'POST',
      /* The anon key is required even though it grants nothing here: Supabase
         edge functions ship with verify_jwt ON, so the gateway 401s the
         request BEFORE the function body (and therefore before the
         x-raffle-key check) ever runs. The anon key satisfies the gateway;
         x-raffle-key is what actually authorises the action. */
      headers: {
        'content-type': 'application/json',
        'x-raffle-key': adminKey,
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      /* raffle-admin requires drawId on every action. Sending it from the
         contract file means the console never depends on the function having
         RAFFLE_DRAW_ID set in its environment. */
      body: JSON.stringify({ action, drawId: DRAW_ID, ...payload }),
    });
  } catch {
    return {
      ok: false,
      unauthorized: false,
      error: 'Could not reach the raffle server. Check your signal and try again.',
    };
  }

  let parsed: unknown = null;
  try {
    parsed = (await res.json()) as unknown;
  } catch {
    parsed = null;
  }
  const body = isRecord(parsed) ? parsed : {};
  const serverMessage = readString(body, ['error', 'message', 'msg', 'detail']);

  if (res.status === 401 || res.status === 403) {
    /* A platform level rejection never reached our key check, so it is a
       deploy problem and not Aaron holding a bad link. Say which one. */
    const gateway = /\bjwt\b|authorization header|\bapikey\b|api key/i.test(serverMessage);
    return {
      ok: false,
      unauthorized: !gateway,
      error: gateway
        ? 'The server rejected this request before it ever looked at the admin key. The raffle-admin function needs to be deployed with JWT verification turned off.'
        : BAD_KEY,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      unauthorized: false,
      error: serverMessage || `The server refused that request (${res.status}).`,
    };
  }

  const inlineError = readString(body, ['error']);
  if (inlineError) return { ok: false, unauthorized: false, error: inlineError };

  return { ok: true, body };
}

/* ------------------------------------------------------------
   Small presentational helpers
   ------------------------------------------------------------ */

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
    </svg>
  );
}

function formatWhen(iso: string): string {
  if (!iso) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  return when.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function prettyHandle(raw: string): string {
  const handle = raw.trim();
  if (!handle) return 'not provided';
  if (handle.startsWith('@') || handle.includes('/') || handle.includes(' ')) return handle;
  return `@${handle}`;
}

/* min-h is not decoration: this gets operated with a thumb, standing up,
   holding a phone in the other hand. 44px is the smallest honest target. */
const SMALL_BTN =
  'font-accent uppercase tracking-wider text-xs px-3 py-2 rounded transition-colors ' +
  'min-h-[44px] inline-flex items-center justify-center ' +
  'disabled:opacity-40 disabled:pointer-events-none';
const SMALL_GHOST = `${SMALL_BTN} border border-white/20 text-white/70 hover:text-white hover:border-white/45`;
const FIELD =
  'w-full bg-navy-900/70 border border-white/15 rounded px-3 py-2.5 text-white text-base ' +
  'placeholder:text-white/30 focus:outline-none focus:border-gold-500/70';
const LABEL = 'text-gold-500/70 font-accent uppercase tracking-widest text-[10px]';

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-navy-800/70 border border-white/10 rounded px-2.5 py-2">
      <div className={LABEL}>{label}</div>
      <div className="text-stadium text-2xl text-white leading-none mt-0.5">{value}</div>
      <div className="text-white/45 text-[11px] leading-tight mt-0.5">{sub}</div>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  tone,
}: {
  title: string;
  count?: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 mt-7 mb-2.5">
      <h2 className={`text-stadium text-xl leading-none ${tone}`}>{title}</h2>
      {count !== undefined && <span className="text-white/40 font-accent text-sm">{count}</span>}
      <div className="flex-1 section-divider" />
    </div>
  );
}

function ShellFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-900 pt-16 flex items-center justify-center px-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease }}
        className="card-electric rounded-lg p-7 max-w-sm w-full text-center"
      >
        {children}
      </motion.div>
    </div>
  );
}

/* ============================================================
   THE PAGE
   ============================================================ */

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

export default function RaffleAdminPage() {
  /* Captured once into memory, then SCRUBBED from the address bar. Nothing is
     written to localStorage or sessionStorage, but the browser persists a full
     URL to history (and syncs it across devices on a signed-in profile), so
     leaving ?k= in place would park the one credential guarding every
     entrant's phone number in the coach's history. It survives in this
     closure for the life of the tab; a reload correctly falls back to the
     no-key gate. */
  const adminKey = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const key = new URLSearchParams(window.location.search).get('k')?.trim() ?? '';
    if (key) {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch {
        /* replaceState can throw in exotic embedding contexts. The console
           still works; the URL just keeps the key. Not worth failing over. */
      }
    }
    return key;
  }, []);

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [entries, setEntries] = useState<AdminEntry[]>([]);

  const [drawStatus, setDrawStatus] = useState<DrawStatus | null>(null);
  const [frozenHash, setFrozenHash] = useState('');
  const [frozenCount, setFrozenCount] = useState<number | null>(null);
  const [winningTicket, setWinningTicket] = useState<number | null>(null);
  const [winnerName, setWinnerName] = useState('');

  const [busyId, setBusyId] = useState('');
  const [rejectingId, setRejectingId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [verifiedNow, setVerifiedNow] = useState<ReadonlySet<string>>(new Set<string>());

  const [freezeConfirm, setFreezeConfirm] = useState('');
  const [freezeBusy, setFreezeBusy] = useState(false);
  /* Not state any more: the source is fixed by the published commitment and
     the database refuses a draw that does not match it. Nothing here may
     change it, so there is no setter to misuse. */
  const seedSource = SEED_SOURCE_LABEL;
  const [seedValue, setSeedValue] = useState('');
  const [drawConfirm, setDrawConfirm] = useState('');
  const [drawBusy, setDrawBusy] = useState(false);

  /* Synchronous latch. `disabled` repaints a frame too late to stop a
     genuine double tap, and a double verify would mint two ticket blocks. */
  const inFlight = useRef(false);
  const claim = useCallback((): boolean => {
    if (inFlight.current) return false;
    inFlight.current = true;
    return true;
  }, []);
  const release = useCallback(() => {
    inFlight.current = false;
  }, []);

  const handleFailure = useCallback((res: { error: string; unauthorized: boolean }) => {
    if (res.unauthorized) {
      setLoadState('unauthorized');
      setLoadError(res.error);
      return;
    }
    setActionError(res.error);
  }, []);

  const applyDraw = useCallback((raw: unknown) => {
    if (!isRecord(raw)) return;
    const status = readDrawStatus(raw);
    if (status) setDrawStatus(status);
    const hash = readString(raw, ['frozen_list_sha256', 'frozenListSha256', 'list_sha256', 'listSha256']);
    if (hash) setFrozenHash(hash);
    const count = readNumber(raw, ['frozen_ticket_count', 'frozenTicketCount', 'ticket_count', 'ticketCount']);
    if (count !== null) setFrozenCount(count);
    const ticket = readNumber(raw, ['winning_ticket', 'winningTicket']);
    if (ticket !== null) setWinningTicket(ticket);
  }, []);

  /* Every setState in here happens AFTER the await on purpose: the mount
     effect calls this, and a synchronous setState in an effect body is a
     cascading render. The spinner state is set by whatever triggered the
     refresh instead. */
  const load = useCallback(async () => {
    if (!adminKey) return;
    const res = await postAdmin(adminKey, 'list', {});
    setActionError('');
    if (!res.ok) {
      setLoadState(res.unauthorized ? 'unauthorized' : 'error');
      setLoadError(res.error);
      return;
    }
    const body = payloadOf(res.body);
    const rawList = body.entries ?? body.rows ?? body.data;
    const list = Array.isArray(rawList) ? rawList : [];
    const parsed: AdminEntry[] = [];
    for (const row of list) {
      const entry = toAdminEntry(row);
      if (entry) parsed.push(entry);
    }
    setEntries(parsed);
    applyDraw(body.draw);
    setLoadError('');
    setLoadState('ready');
  }, [adminKey, applyDraw]);

  useEffect(() => {
    /* Deferred a tick: load() sets state on its early-exit paths, and doing
       that synchronously inside the effect cascades an extra render. */
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  /* ---------- derived ---------- */

  const groups = useMemo(() => {
    const byOldest = (a: AdminEntry, b: AdminEntry) => a.createdAt.localeCompare(b.createdAt);
    return {
      pending: entries.filter((e) => e.status === 'pending').sort(byOldest),
      verified: entries
        .filter((e) => e.status === 'verified')
        .sort((a, b) => (a.ticketStart ?? 0) - (b.ticketStart ?? 0)),
      rejected: entries.filter((e) => e.status === 'rejected').sort((a, b) => byOldest(b, a)),
    };
  }, [entries]);

  const totals = useMemo(() => {
    let pendingCount = 0;
    let pendingCents = 0;
    let verifiedCount = 0;
    let verifiedCents = 0;
    let tickets = 0;
    for (const entry of entries) {
      if (entry.status === 'pending') {
        pendingCount += 1;
        pendingCents += entry.amountCents;
      } else if (entry.status === 'verified') {
        verifiedCount += 1;
        verifiedCents += entry.amountCents;
        tickets += entry.chances;
      }
    }
    return { pendingCount, pendingCents, verifiedCount, verifiedCents, tickets };
  }, [entries]);

  const winnerEntry = useMemo(() => {
    if (winningTicket === null) return null;
    return (
      entries.find(
        (e) =>
          e.ticketStart !== null &&
          e.ticketEnd !== null &&
          winningTicket >= e.ticketStart &&
          winningTicket <= e.ticketEnd,
      ) ?? null
    );
  }, [entries, winningTicket]);

  /* ---------- privileged actions ---------- */

  const runVerify = useCallback(
    async (entry: AdminEntry) => {
      if (!claim()) return;
      setBusyId(entry.id);
      setActionError('');
      const res = await postAdmin(adminKey, 'verify', { entryId: entry.id });
      setBusyId('');
      release();
      if (!res.ok) {
        handleFailure(res);
        return;
      }
      const body = payloadOf(res.body);
      const start = readNumber(body, ['ticketStart', 'ticket_start']);
      const end = readNumber(body, ['ticketEnd', 'ticket_end']);
      setEntries((prev) =>
        prev.map((row): AdminEntry =>
          row.id === entry.id
            ? { ...row, status: 'verified', ticketStart: start, ticketEnd: end, rejectReason: null }
            : row,
        ),
      );
      setVerifiedNow((prev) => new Set(prev).add(entry.id));
      /* The tickets are the receipt. If the response did not carry them,
         do not guess: go and read the real row back. */
      if (start === null || end === null) void load();
    },
    [adminKey, claim, release, handleFailure, load],
  );

  const runReject = useCallback(
    async (entry: AdminEntry) => {
      const reason = rejectReason.trim();
      if (!reason) {
        setActionError('Give a short reason so the entrant sees why.');
        return;
      }
      if (!claim()) return;
      setBusyId(entry.id);
      setActionError('');
      const res = await postAdmin(adminKey, 'reject', { entryId: entry.id, reason });
      setBusyId('');
      release();
      if (!res.ok) {
        handleFailure(res);
        return;
      }
      setEntries((prev) =>
        prev.map((row): AdminEntry =>
          row.id === entry.id
            ? { ...row, status: 'rejected', ticketStart: null, ticketEnd: null, rejectReason: reason }
            : row,
        ),
      );
      setRejectingId('');
      setRejectReason('');
    },
    [adminKey, rejectReason, claim, release, handleFailure],
  );

  const runFreeze = useCallback(async () => {
    if (!claim()) return;
    setFreezeBusy(true);
    setActionError('');
    const res = await postAdmin(adminKey, 'freeze', {});
    setFreezeBusy(false);
    release();
    if (!res.ok) {
      handleFailure(res);
      return;
    }
    const body = payloadOf(res.body);
    const hash = readString(body, ['listSha256', 'list_sha256', 'hash', 'sha256']);
    const count = readNumber(body, ['ticketCount', 'ticket_count', 'count']);
    if (hash) setFrozenHash(hash);
    if (count !== null) setFrozenCount(count);
    setDrawStatus('frozen');
    setFreezeConfirm('');
  }, [adminKey, claim, release, handleFailure]);

  const runDraw = useCallback(async () => {
    const value = seedValue.trim();
    const source = seedSource.trim();
    if (!value) {
      setActionError('Enter the public number before drawing.');
      return;
    }
    if (!claim()) return;
    setDrawBusy(true);
    setActionError('');
    const res = await postAdmin(adminKey, 'draw', { seedSource: source, seedValue: value });
    setDrawBusy(false);
    release();
    if (!res.ok) {
      handleFailure(res);
      return;
    }
    const body = payloadOf(res.body);
    const ticket = readNumber(body, ['winningTicket', 'winning_ticket']);
    const name = readString(body, ['displayName', 'display_name', 'winner']);
    if (ticket !== null) setWinningTicket(ticket);
    if (name) setWinnerName(name);
    setDrawStatus('drawn');
    setDrawConfirm('');
  }, [adminKey, seedSource, seedValue, claim, release, handleFailure]);

  /* ---------- gates ---------- */

  if (!adminKey) {
    return (
      <ShellFrame>
        <BoltIcon className="w-6 h-6 text-gold-500/60 mx-auto" />
        <div className="text-stadium text-2xl text-white mt-3 leading-tight">
          This page needs an admin link
        </div>
        <p className="mt-3 text-white/55 text-sm leading-relaxed">
          Open the full link you were sent, including the key on the end of the address. Without it
          there is nothing here.
        </p>
      </ShellFrame>
    );
  }

  if (loadState === 'unauthorized') {
    return (
      <ShellFrame>
        <div className="text-stadium text-2xl text-red-400 leading-tight">{BAD_KEY}</div>
        <p className="mt-3 text-white/55 text-sm leading-relaxed">
          {loadError && loadError !== BAD_KEY
            ? loadError
            : 'Nothing was changed. Open the most recent admin link you were sent, or ask for a fresh one.'}
        </p>
        <button
          type="button"
          onClick={() => {
            setLoadState('loading');
            void load();
          }}
          className={`${SMALL_GHOST} mt-5`}
        >
          Try again
        </button>
      </ShellFrame>
    );
  }

  const listBusy = loadState === 'loading';
  /* raffle-admin refuses verify with a 409 once the draw leaves 'open', because
     a ticket minted after the freeze would sit outside the published
     fingerprint. Mirror that here so the button never invites a tap that
     cannot land. Unknown status (null) leaves the button alone: the server
     stays the authority, this only stops offering what it will refuse. */
  const ticketsClosed = drawStatus !== null && drawStatus !== 'open';

  /* ---------- console ---------- */

  return (
    <div className="min-h-screen bg-navy-900 pt-16">
      <div className="sticky top-16 z-30 bg-navy-900/95 backdrop-blur border-b border-gold-500/15">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-stadium text-lg leading-none">
                <span className="text-white">RAFFLE</span>{' '}
                <span className="text-gold-500">CONSOLE</span>
              </div>
              <div className="text-white/35 text-[11px] mt-0.5 truncate">
                {DRAW_ID}
                {drawStatus ? ` · ${drawStatus}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setLoadState('loading');
                void load();
              }}
              disabled={listBusy}
              className={SMALL_GHOST}
            >
              {listBusy ? 'Loading' : 'Refresh'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-2.5">
            <StatTile
              label="Pending"
              value={String(totals.pendingCount)}
              sub={`${formatUsd(totals.pendingCents)} to match`}
            />
            <StatTile
              label="Verified"
              value={String(totals.verifiedCount)}
              sub={`${totals.tickets} ticket${totals.tickets === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Confirmed"
              value={formatUsd(totals.verifiedCents)}
              sub="money in hand"
            />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-5 pb-24">
        <p className="text-white/40 text-xs mt-3 leading-relaxed">
          Match each pending entry against the {VENMO.displayName} Venmo feed, then verify it. Entries
          close {ENTRIES_CLOSE_LABEL}. Drawing is {DRAW_TIME_LABEL}.
        </p>

        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease }}
              className="mt-3 rounded border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-red-200 text-sm"
              role="alert"
            >
              {actionError}
            </motion.div>
          )}
        </AnimatePresence>

        {loadState === 'error' && (
          <div className="mt-3 rounded border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-red-200 text-sm">
            {loadError}
          </div>
        )}

        {listBusy && entries.length === 0 && (
          <p className="mt-8 text-center text-white/40 font-accent uppercase tracking-widest text-sm">
            Loading entries
          </p>
        )}

        {loadState === 'ready' && entries.length === 0 && (
          <p className="mt-8 text-center text-white/40 text-sm">
            No entries yet. This fills up as people send money and fill out the form.
          </p>
        )}

        {/* ---------------- PENDING ---------------- */}
        <SectionHeading title="Pending" count={groups.pending.length} tone="text-gold-500" />
        {drawStatus !== null && drawStatus !== 'open' && groups.pending.length > 0 && (
          <div className="mb-3 rounded border border-gold-500/30 bg-gold-500/5 px-3 py-2.5 text-gold-200/80 text-sm">
            This draw is {drawStatus}. The numbered list is already published, so nothing here can be
            given ticket numbers any more.
          </div>
        )}
        {groups.pending.length === 0 ? (
          <p className="text-white/35 text-sm">Nothing waiting. Every entry is settled.</p>
        ) : (
          <div className="space-y-3">
            {groups.pending.map((entry, index) => {
              const busy = busyId === entry.id;
              const rejecting = rejectingId === entry.id;
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: Math.min(index, 6) * 0.03, ease }}
                  className="card-electric rounded-lg p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-base leading-tight break-words">
                        {entry.fullName || entry.displayName}
                      </div>
                      <div className="text-white/40 text-xs mt-0.5">
                        shows publicly as {entry.displayName}
                      </div>
                    </div>
                    <div className="text-white/35 text-[11px] whitespace-nowrap pt-0.5">
                      {formatWhen(entry.createdAt)}
                    </div>
                  </div>

                  {/* The actual job: these two numbers, side by side. */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="bg-navy-900/60 border border-white/10 rounded px-2.5 py-2 min-w-0">
                      <div className={LABEL}>Venmo</div>
                      <div className="text-white text-base leading-tight break-all mt-0.5">
                        {prettyHandle(entry.venmoHandle)}
                      </div>
                    </div>
                    <div className="bg-navy-900/60 border border-gold-500/25 rounded px-2.5 py-2">
                      <div className={LABEL}>Expected</div>
                      <div className="text-stadium text-2xl text-gold-500 leading-none mt-0.5">
                        {formatUsd(entry.amountCents)}
                      </div>
                      <div className="text-white/45 text-[11px] mt-0.5">
                        {entry.chances} x {formatUsd(PRICE_PER_CHANCE_CENTS)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {entry.phone && (
                      <a
                        href={`tel:${entry.phone.replace(/[^\d+]/g, '')}`}
                        className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                      >
                        {entry.phone}
                      </a>
                    )}
                    {entry.email && (
                      <a
                        href={`mailto:${entry.email}`}
                        className="text-white/45 hover:text-white/80 break-all text-xs"
                      >
                        {entry.email}
                      </a>
                    )}
                    {entry.receiptCode && (
                      <span className="text-white/35 text-xs font-mono">{entry.receiptCode}</span>
                    )}
                  </div>

                  {entry.note && (
                    <p className="mt-2 text-white/55 text-sm border-l-2 border-white/15 pl-2.5 break-words">
                      {entry.note}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void runVerify(entry)}
                      disabled={busy || ticketsClosed}
                      className={`btn-lightning text-sm w-full ${
                        busy || ticketsClosed ? 'opacity-40 pointer-events-none' : ''
                      }`}
                    >
                      {busy ? 'Working' : 'Verify'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError('');
                        setRejectReason('');
                        setRejectingId(rejecting ? '' : entry.id);
                      }}
                      disabled={busy}
                      className={SMALL_GHOST}
                    >
                      {rejecting ? 'Cancel' : 'Reject'}
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {rejecting && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3">
                          <label className={LABEL} htmlFor={`reason-${entry.id}`}>
                            Reason the entrant will see
                          </label>
                          <input
                            id={`reason-${entry.id}`}
                            type="text"
                            value={rejectReason}
                            maxLength={280}
                            autoComplete="off"
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="No matching Venmo payment"
                            className={`${FIELD} mt-1`}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() => void runReject(entry)}
                              disabled={busy || !rejectReason.trim()}
                              className={`${SMALL_BTN} bg-red-500/85 text-white hover:bg-red-500`}
                            >
                              {busy ? 'Working' : 'Confirm reject'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId('');
                                setRejectReason('');
                              }}
                              disabled={busy}
                              className={SMALL_GHOST}
                            >
                              Keep pending
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ---------------- VERIFIED ---------------- */}
        <SectionHeading title="Verified" count={groups.verified.length} tone="text-white" />
        {groups.verified.length === 0 ? (
          <p className="text-white/35 text-sm">No tickets issued yet.</p>
        ) : (
          <div className="space-y-2">
            {groups.verified.map((entry) => {
              const fresh = verifiedNow.has(entry.id);
              const range =
                entry.ticketStart !== null && entry.ticketEnd !== null
                  ? formatTicketRange(entry.ticketStart, entry.ticketEnd)
                  : 'pending numbers';
              return (
                <div
                  key={entry.id}
                  className={`rounded border px-3 py-2.5 ${
                    fresh
                      ? 'border-gold-500/70 bg-gold-500/10'
                      : 'border-white/10 bg-navy-800/60'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-stadium text-xl text-gold-500 leading-none whitespace-nowrap">
                      {range}
                    </div>
                    <div className="text-white/45 text-xs whitespace-nowrap">
                      {formatUsd(entry.amountCents)} · {entry.chances} chance
                      {entry.chances === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-white text-sm break-words">
                      {entry.fullName || entry.displayName}
                    </span>
                    <span className="text-white/35 text-xs break-all">
                      {prettyHandle(entry.venmoHandle)}
                    </span>
                    {/* The winner is always a VERIFIED entry, so this compact
                        card is the one the coach is looking at when he needs to
                        call somebody. Dropping the number here left him with no
                        way to reach the winner from this screen. */}
                    {entry.phone && (
                      <a
                        href={`tel:${entry.phone.replace(/[^\d+]/g, '')}`}
                        className="text-gold-400/80 hover:text-gold-300 text-xs underline underline-offset-2 whitespace-nowrap"
                      >
                        {entry.phone}
                      </a>
                    )}
                    {entry.receiptCode && (
                      <span className="text-white/25 text-[11px] font-mono">{entry.receiptCode}</span>
                    )}
                  </div>
                  {fresh && (
                    <div className="mt-1 text-gold-400 font-accent uppercase tracking-widest text-[10px]">
                      Just assigned
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------- REJECTED ---------------- */}
        {groups.rejected.length > 0 && (
          <>
            <SectionHeading title="Rejected" count={groups.rejected.length} tone="text-white/50" />
            <div className="space-y-2">
              {groups.rejected.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded border border-white/10 bg-navy-800/40 px-3 py-2.5 opacity-70"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-white/80 text-sm break-words">
                      {entry.fullName || entry.displayName}
                    </span>
                    <span className="text-white/35 text-xs whitespace-nowrap">
                      {formatUsd(entry.amountCents)}
                    </span>
                  </div>
                  <div className="text-white/40 text-xs mt-0.5 break-words">
                    {entry.rejectReason || 'no reason recorded'}
                  </div>
                  <div className="text-white/25 text-[11px] mt-0.5 break-all">
                    {prettyHandle(entry.venmoHandle)}
                    {entry.receiptCode ? ` · ${entry.receiptCode}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ---------------- FREEZE ---------------- */}
        <SectionHeading title="Freeze the list" tone="text-gold-500" />
        <div className="card-electric rounded-lg p-3.5">
          <p className="text-white/55 text-sm leading-relaxed">
            Do this once every payment is matched and before the drawing. It locks the numbered list
            and publishes a fingerprint of it, so nobody can claim the list was edited afterwards.
          </p>

          {frozenHash ? (
            <div className="mt-3 rounded border border-gold-500/30 bg-navy-900/60 px-3 py-2.5">
              <div className={LABEL}>Published fingerprint</div>
              <div className="text-gold-400 text-[11px] font-mono break-all mt-1">{frozenHash}</div>
              <div className="text-white/50 text-xs mt-1.5">
                {frozenCount === null ? '' : `${frozenCount} tickets frozen`}
              </div>
            </div>
          ) : (
            <>
              <label className={`${LABEL} block mt-3`} htmlFor="freeze-confirm">
                Type FREEZE to enable
              </label>
              <input
                id="freeze-confirm"
                type="text"
                value={freezeConfirm}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setFreezeConfirm(e.target.value)}
                placeholder="FREEZE"
                className={`${FIELD} mt-1`}
              />
              <button
                type="button"
                onClick={() => void runFreeze()}
                disabled={
                  freezeBusy ||
                  freezeConfirm.trim().toUpperCase() !== 'FREEZE' ||
                  (drawStatus !== null && drawStatus !== 'open')
                }
                className={`btn-lightning text-sm w-full mt-2.5 ${
                  freezeBusy ||
                  freezeConfirm.trim().toUpperCase() !== 'FREEZE' ||
                  (drawStatus !== null && drawStatus !== 'open')
                    ? 'opacity-40 pointer-events-none'
                    : ''
                }`}
              >
                {freezeBusy ? 'Freezing' : 'Freeze the list'}
              </button>
              {drawStatus !== null && drawStatus !== 'open' && (
                <p className="mt-2 text-white/40 text-xs">
                  This draw is already {drawStatus}, so it cannot be frozen again.
                </p>
              )}
            </>
          )}
        </div>

        {/* ---------------- DRAW ---------------- */}
        <SectionHeading title="Run the drawing" tone="text-gold-500" />
        <div className="card-electric rounded-lg p-3.5">
          {winningTicket !== null ? (
            <div className="text-center py-2">
              <div className={LABEL}>Winning ticket</div>
              <div className="text-stadium text-6xl text-gold-500 glow-gold leading-none mt-1">
                #{winningTicket}
              </div>
              <div className="text-white text-lg mt-2 break-words">
                {winnerName || winnerEntry?.displayName || 'no matching ticket'}
              </div>
              {winnerEntry && (
                <div className="text-white/45 text-xs mt-1">
                  holds{' '}
                  {winnerEntry.ticketStart !== null && winnerEntry.ticketEnd !== null
                    ? formatTicketRange(winnerEntry.ticketStart, winnerEntry.ticketEnd)
                    : ''}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-white/55 text-sm leading-relaxed">
                The winning number is computed from a public number nobody on the team controls, so
                anyone can recheck the math. Freeze the list first.
              </p>

              {/* READ ONLY on purpose. The seed source is part of the published
                  commitment: the database refuses a draw whose source does not
                  match what the raffle promised. An editable box here would let
                  an operator shop for a source after seeing the numbers, which
                  is exactly the thing this whole design exists to prevent. */}
              <div className={`${LABEL} mt-3`}>Where the number comes from</div>
              <div className="mt-1 rounded-md border border-white/10 bg-navy-900/60 px-3 py-2 text-white/80 font-body text-sm">
                {seedSource}
              </div>
              <p className="mt-1 text-white/40 font-body text-xs">
                Locked to what was published before the freeze. It cannot be changed here.
              </p>

              <label className={`${LABEL} block mt-3`} htmlFor="seed-value">
                The number, exactly as published
              </label>
              <input
                id="seed-value"
                type="text"
                value={seedValue}
                inputMode="numeric"
                autoComplete="off"
                onChange={(e) => setSeedValue(e.target.value)}
                placeholder="000"
                className={`${FIELD} mt-1`}
              />

              <label className={`${LABEL} block mt-3`} htmlFor="draw-confirm">
                Type DRAW to enable
              </label>
              <input
                id="draw-confirm"
                type="text"
                value={drawConfirm}
                autoComplete="off"
                autoCapitalize="characters"
                onChange={(e) => setDrawConfirm(e.target.value)}
                placeholder="DRAW"
                className={`${FIELD} mt-1`}
              />

              <button
                type="button"
                onClick={() => void runDraw()}
                disabled={
                  drawBusy ||
                  drawConfirm.trim().toUpperCase() !== 'DRAW' ||
                  !seedValue.trim() ||
                  (drawStatus !== null && drawStatus !== 'frozen')
                }
                className={`btn-lightning text-sm w-full mt-2.5 ${
                  drawBusy ||
                  drawConfirm.trim().toUpperCase() !== 'DRAW' ||
                  !seedValue.trim() ||
                  (drawStatus !== null && drawStatus !== 'frozen')
                    ? 'opacity-40 pointer-events-none'
                    : ''
                }`}
              >
                {drawBusy ? 'Drawing' : 'Run the drawing'}
              </button>

              {drawStatus !== null && drawStatus !== 'frozen' && (
                <p className="mt-2 text-white/40 text-xs">
                  This draw is {drawStatus}. It has to be frozen before it can be drawn.
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-8 text-white/25 text-[11px] leading-relaxed">
          Everything on this screen is private. Only a first name and last initial ever reach the
          public board. Do not forward this link or screenshot the address bar: the key on the end
          of it is the only thing standing between the raffle and anyone.
        </p>
      </div>
    </div>
  );
}
