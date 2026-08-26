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
  SEED_AVAILABLE_AT,
  FREEZE_DEADLINE_LABEL,
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
   THE REAL CLOCK.

   The deadline that matters in this console is NOT the drawing.
   raffle_freeze refuses to seal the list from seed_available_at
   onwards, because the seed drawing publishes then and a list
   sealed after the winning number exists proves nothing. That is
   5h40m before the drawing this page names. A coach who works to
   the drawing time misses the freeze and the raffle cannot be
   drawn at all, so the console works to THIS instant.
   ------------------------------------------------------------ */
const FREEZE_DEADLINE_MS = new Date(SEED_AVAILABLE_AT).getTime();

/** How often the console re-checks the wall clock against that deadline. */
const CLOCK_TICK_MS = 30_000;

/* Error scopes. Entry-level errors are keyed by the entry's own id, so these
   three carry a prefix no UUID can collide with. */
const SCOPE_FREEZE = 'panel:freeze';
const SCOPE_DRAW = 'panel:draw';
const SCOPE_VIDEO = 'panel:video';

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

/** Mirrors the same check in the edge function, so a bad link fails here
    instead of costing a round trip on a phone with one bar of signal. */
function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** "3d 4h" / "4h 12m" / "12m". Coarse on purpose: the clock ticks every
    30 seconds, so a seconds field would sit visibly wrong most of the time. */
function formatTimeLeft(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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

/* A failure has to appear where the thumb just was. This console scrolls for
   pages, and a banner pinned to the top is invisible to somebody working the
   fortieth pending entry. */
function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-2 rounded border border-red-500/45 bg-red-950/50 px-2.5 py-2 text-red-200 text-xs leading-relaxed break-words"
    >
      {message}
    </p>
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
  /* Keyed by entry id for the entry cards, and by the SCOPE_* constants for
     the three panels. Every failure paints beside the control that caused it;
     the banner at the top of the page is for load level failures only. */
  const [scopedErrors, setScopedErrors] = useState<Readonly<Record<string, string>>>({});
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

  /* Publishing the recording. The public page promises every entrant this
     video, and the edge function has always accepted it; nothing on this
     screen ever called it. savedVideoUrl is whatever the draw row holds now,
     read back out of the list response so a re-save shows what is already set. */
  const [videoUrl, setVideoUrl] = useState('');
  const [savedVideoUrl, setSavedVideoUrl] = useState('');
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoJustSaved, setVideoJustSaved] = useState(false);
  /* Refreshing must not overwrite a link the coach is halfway through typing. */
  const videoTouched = useRef(false);

  /* The freeze deadline is a wall clock fact, so the console has to notice it
     passing without a reload. Coarse tick: this page can be rendering a hundred
     entry cards and nothing here needs second resolution. */
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  const msToFreezeDeadline = FREEZE_DEADLINE_MS - nowMs;
  /* If the contract date ever failed to parse this is NaN, every comparison is
     false, and the console leaves the freeze button alone rather than blocking
     a freeze that would actually have worked. */
  const freezeWindowPassed = msToFreezeDeadline <= 0;

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

  const noteError = useCallback((scope: string, message: string) => {
    setScopedErrors((prev) => {
      if (message) return { ...prev, [scope]: message };
      if (!(scope in prev)) return prev;
      return Object.fromEntries(Object.entries(prev).filter(([key]) => key !== scope));
    });
  }, []);

  /* A bad key is not a per card problem: it means every remaining tap will
     fail the same way, so it still takes over the whole screen. */
  const handleFailure = useCallback(
    (scope: string, res: { error: string; unauthorized: boolean }) => {
      if (res.unauthorized) {
        setLoadState('unauthorized');
        setLoadError(res.error);
        return;
      }
      noteError(scope, res.error);
    },
    [noteError],
  );

  const applyDraw = useCallback((raw: unknown) => {
    if (!isRecord(raw)) return;
    const status = readDrawStatus(raw);
    if (status) setDrawStatus(status);
    /* Unlike the fields below, an empty video URL is real information: it means
       nothing is published yet. Take it verbatim. */
    const video = readString(raw, ['draw_video_url', 'drawVideoUrl', 'videoUrl', 'video_url']);
    setSavedVideoUrl(video);
    if (!videoTouched.current) setVideoUrl(video);
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
    /* Fresh data, so every stale per card failure goes with it. */
    setScopedErrors({});
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
      noteError(entry.id, '');
      const res = await postAdmin(adminKey, 'verify', { entryId: entry.id });
      setBusyId('');
      release();
      if (!res.ok) {
        handleFailure(entry.id, res);
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
    [adminKey, claim, release, handleFailure, noteError, load],
  );

  const runReject = useCallback(
    async (entry: AdminEntry) => {
      const reason = rejectReason.trim();
      if (!reason) {
        noteError(entry.id, 'Give a short reason so the entrant sees why.');
        return;
      }
      if (!claim()) return;
      setBusyId(entry.id);
      noteError(entry.id, '');
      const res = await postAdmin(adminKey, 'reject', { entryId: entry.id, reason });
      setBusyId('');
      release();
      if (!res.ok) {
        handleFailure(entry.id, res);
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
    [adminKey, rejectReason, claim, release, handleFailure, noteError],
  );

  const runFreeze = useCallback(async () => {
    if (!claim()) return;
    setFreezeBusy(true);
    noteError(SCOPE_FREEZE, '');
    const res = await postAdmin(adminKey, 'freeze', {});
    setFreezeBusy(false);
    release();
    if (!res.ok) {
      handleFailure(SCOPE_FREEZE, res);
      return;
    }
    const body = payloadOf(res.body);
    const hash = readString(body, ['listSha256', 'list_sha256', 'hash', 'sha256']);
    const count = readNumber(body, ['ticketCount', 'ticket_count', 'count']);
    if (hash) setFrozenHash(hash);
    if (count !== null) setFrozenCount(count);
    setDrawStatus('frozen');
    setFreezeConfirm('');
  }, [adminKey, claim, release, handleFailure, noteError]);

  const runDraw = useCallback(async () => {
    const value = seedValue.trim();
    const source = seedSource.trim();
    if (!value) {
      noteError(SCOPE_DRAW, 'Enter the public number before drawing.');
      return;
    }
    if (!claim()) return;
    setDrawBusy(true);
    noteError(SCOPE_DRAW, '');
    const res = await postAdmin(adminKey, 'draw', { seedSource: source, seedValue: value });
    setDrawBusy(false);
    release();
    if (!res.ok) {
      handleFailure(SCOPE_DRAW, res);
      return;
    }
    const body = payloadOf(res.body);
    const ticket = readNumber(body, ['winningTicket', 'winning_ticket']);
    const name = readString(body, ['displayName', 'display_name', 'winner']);
    if (ticket !== null) setWinningTicket(ticket);
    if (name) setWinnerName(name);
    setDrawStatus('drawn');
    setDrawConfirm('');
  }, [adminKey, seedSource, seedValue, claim, release, handleFailure, noteError]);

  const runVideo = useCallback(async () => {
    const url = videoUrl.trim();
    /* The same check the edge function runs. Catching it here saves a round
       trip and, more to the point, says what is wrong with the link. */
    if (!isHttpUrl(url)) {
      noteError(SCOPE_VIDEO, 'Paste the whole link, starting with https://');
      return;
    }
    if (!claim()) return;
    setVideoBusy(true);
    setVideoJustSaved(false);
    noteError(SCOPE_VIDEO, '');
    const res = await postAdmin(adminKey, 'video', { videoUrl: url });
    setVideoBusy(false);
    release();
    if (!res.ok) {
      handleFailure(SCOPE_VIDEO, res);
      return;
    }
    const body = payloadOf(res.body);
    const saved = readString(body, ['videoUrl', 'video_url', 'draw_video_url']) || url;
    setSavedVideoUrl(saved);
    setVideoUrl(saved);
    setVideoJustSaved(true);
    /* Server and field agree again, so a later refresh may resync the field. */
    videoTouched.current = false;
  }, [adminKey, videoUrl, claim, release, handleFailure, noteError]);

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
        {/* The three dates, in the order they actually happen. The middle one
            is the one that ends the raffle if it is missed, so it is the one
            wearing the colour. */}
        <p className="text-white/40 text-xs mt-3 leading-relaxed">
          Match each pending entry against the {VENMO.displayName} Venmo feed, then verify it. Entries
          close {ENTRIES_CLOSE_LABEL}.{' '}
          <strong className="text-gold-400 font-semibold not-italic">
            The list must be frozen by {FREEZE_DEADLINE_LABEL}.
          </strong>{' '}
          Drawing is {DRAW_TIME_LABEL}.
        </p>

        {/* Load level only. Everything a button can go wrong with is painted
            beside that button instead. */}
        <AnimatePresence>
          {loadState === 'error' && loadError && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease }}
              className="mt-3 rounded border border-red-500/40 bg-red-950/40 px-3 py-2.5 text-red-200 text-sm"
              role="alert"
            >
              {loadError}
            </motion.div>
          )}
        </AnimatePresence>

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
              const entryError = scopedErrors[entry.id] ?? '';
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
                        noteError(entry.id, '');
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

                  <ErrorNote message={entryError} />
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
              {/* Deliberately NOT dimmed with opacity: these cards carry a live
                  control now, and a 70% button is a button nobody trusts is
                  tappable. The muted text colours already read as settled. */}
              {groups.rejected.map((entry) => {
                const busy = busyId === entry.id;
                const entryError = scopedErrors[entry.id] ?? '';
                return (
                  <div
                    key={entry.id}
                    className="rounded border border-white/10 bg-navy-800/40 px-3 py-2.5"
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

                    {/* Rejecting is one tap on a phone, and it is the wrong tap
                        often enough to matter. The server will still verify a
                        rejected entry while the draw is open, so this undoes it
                        rather than leaving the coach to text somebody. Once the
                        list is frozen the pool is closed and this disappears. */}
                    {drawStatus === 'open' && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <button
                          type="button"
                          onClick={() => void runVerify(entry)}
                          disabled={busy}
                          className={SMALL_GHOST}
                        >
                          {busy ? 'Working' : 'Verify anyway'}
                        </button>
                        <span className="text-white/30 text-[11px] leading-tight">
                          Rejected by mistake? This issues ticket numbers.
                        </span>
                      </div>
                    )}

                    <ErrorNote message={entryError} />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ---------------- FREEZE ---------------- */}
        <SectionHeading title="Freeze the list" tone="text-gold-500" />
        <div className="card-electric rounded-lg p-3.5">
          <p className="text-white/55 text-sm leading-relaxed">
            Do this once every payment is matched. It locks the numbered list and publishes a
            fingerprint of it, so nobody can claim the list was edited afterwards.
          </p>

          {frozenHash ? (
            <div className="mt-3 rounded border border-gold-500/30 bg-navy-900/60 px-3 py-2.5">
              <div className={LABEL}>Published fingerprint</div>
              <div className="text-gold-400 text-[11px] font-mono break-all mt-1">{frozenHash}</div>
              <div className="text-white/50 text-xs mt-1.5">
                {frozenCount === null ? '' : `${frozenCount} tickets frozen`}
              </div>
            </div>
          ) : freezeWindowPassed && drawStatus !== 'frozen' && drawStatus !== 'drawn' ? (
            /* The window is gone and no tap on this screen can bring it back.
               Say so, and do not leave a button sitting there that the database
               is going to refuse. */
            <div
              className="mt-3 rounded border border-red-500/50 bg-red-950/50 px-3 py-3"
              role="alert"
            >
              <div className="font-accent uppercase tracking-widest text-[10px] text-red-300">
                The freeze window has passed
              </div>
              <p className="text-red-100/90 text-sm leading-relaxed mt-1.5">
                It is now past {FREEZE_DEADLINE_LABEL}, so the {SEED_SOURCE_LABEL} has already
                published its number. The database refuses a freeze from that moment on, because a
                list sealed after the winning number exists proves nothing. Nothing on this screen
                can get around that, and the drawing cannot be run on an unfrozen list.
              </p>
              <p className="text-red-100/90 text-sm leading-relaxed mt-2">
                Contact whoever runs the site now, before the {DRAW_TIME_LABEL} drawing, and do not
                announce a winner until they answer.
              </p>
            </div>
          ) : (
            <>
              {/* The deadline the coach is actually racing. It is not the
                  drawing, and the gap between the two is most of a workday. */}
              <div className="mt-3 rounded border border-gold-500/45 bg-gold-500/10 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <div className={LABEL}>Hard deadline</div>
                  <div className="text-gold-300 font-accent uppercase tracking-wider text-[11px] whitespace-nowrap">
                    {formatTimeLeft(msToFreezeDeadline)} left
                  </div>
                </div>
                <p className="text-gold-100/90 text-sm leading-relaxed mt-1.5">
                  Freeze before {FREEZE_DEADLINE_LABEL}. The {SEED_SOURCE_LABEL} publishes then, and
                  a list sealed after the winning number exists proves nothing, so the database
                  refuses a freeze from that moment on. Do not wait for the {DRAW_TIME_LABEL}{' '}
                  drawing.
                </p>
              </div>

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
              <ErrorNote message={scopedErrors[SCOPE_FREEZE] ?? ''} />
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

              <p className="mt-2 text-white/45 text-xs leading-relaxed">
                This writes the winner straight to the public page. It runs once and cannot be
                undone or run again.
              </p>

              {drawStatus !== null && drawStatus !== 'frozen' && (
                <p className="mt-2 text-white/40 text-xs">
                  This draw is {drawStatus}. It has to be frozen before it can be drawn.
                </p>
              )}
              <ErrorNote message={scopedErrors[SCOPE_DRAW] ?? ''} />
            </>
          )}
        </div>

        {/* ---------------- VIDEO ---------------- */}
        {/* The rules promise every entrant this recording, and until now the
            only way to keep that promise was a hand written database update. */}
        {drawStatus === 'drawn' && (
          <>
            <SectionHeading title="Publish the recording" tone="text-gold-500" />
            <div className="card-electric rounded-lg p-3.5">
              <p className="text-white/55 text-sm leading-relaxed">
                Everyone who entered was promised the video of the drawing. Paste the link to it and
                save, and it appears on the public raffle page.
              </p>

              {savedVideoUrl && (
                <div className="mt-3 rounded border border-gold-500/30 bg-navy-900/60 px-3 py-2.5">
                  <div className={LABEL}>Posted right now</div>
                  <a
                    href={savedVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-gold-400 hover:text-gold-300 text-xs break-all mt-1 underline underline-offset-2"
                  >
                    {savedVideoUrl}
                  </a>
                </div>
              )}

              <label className={`${LABEL} block mt-3`} htmlFor="video-url">
                Link to the recording
              </label>
              <input
                id="video-url"
                type="url"
                inputMode="url"
                value={videoUrl}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => {
                  videoTouched.current = true;
                  setVideoJustSaved(false);
                  noteError(SCOPE_VIDEO, '');
                  setVideoUrl(e.target.value);
                }}
                placeholder="https://"
                className={`${FIELD} mt-1`}
              />

              <button
                type="button"
                onClick={() => void runVideo()}
                disabled={videoBusy || !videoUrl.trim()}
                className={`btn-lightning text-sm w-full mt-2.5 ${
                  videoBusy || !videoUrl.trim() ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                {videoBusy ? 'Saving' : savedVideoUrl ? 'Update the link' : 'Publish the link'}
              </button>

              {videoJustSaved && (
                <p className="mt-2 text-gold-400 font-accent uppercase tracking-widest text-[10px]">
                  Saved. It is on the public page now.
                </p>
              )}
              <ErrorNote message={scopedErrors[SCOPE_VIDEO] ?? ''} />
            </div>
          </>
        )}

        <p className="mt-8 text-white/25 text-[11px] leading-relaxed">
          Everything on this screen is private. Only a first name and last initial ever reach the
          public board. Do not forward this link or screenshot the address bar: the key on the end
          of it is the only thing standing between the raffle and anyone.
        </p>
      </div>
    </div>
  );
}
