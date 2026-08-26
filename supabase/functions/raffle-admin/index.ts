/* ============================================================
   LOUISVILLE LIGHTNING - raffle-admin
   ------------------------------------------------------------
   The ONLY thing in this system that holds the service role key.
   Every decision that changes who can win a glove passes through
   here: verify, reject, freeze, draw, publish the video.

   The public site is a static SPA. Its anon key is inside the JS
   bundle, so the browser can never be trusted with any of this.
   The migrations (supabase/migrations/20260825_create_raffle.sql,
   then 20260825b_raffle_hardening.sql) revoke execute on
   raffle_verify_entry, raffle_freeze and raffle_execute_draw from
   anon and grant them to service_role only. This function is the
   one holder of that role.

   Nothing here is gated by a client-side PIN. The gate is the
   x-raffle-key header, compared in constant time against the
   RAFFLE_ADMIN_KEY secret, which exists only in the Supabase
   function environment and never in the shipped bundle.

   Configured entirely by secrets, so no date, price, draw id,
   URL or rule string is hard-coded in here. See README.md.
   ============================================================ */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

/* ------------------------------------------------------------
   Environment. Read once, at cold start.
   ------------------------------------------------------------ */

const ADMIN_KEY = Deno.env.get('RAFFLE_ADMIN_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/**
 * Comma separated browser origins allowed to read a response.
 * Set it (see README). Left unset, the request origin is echoed
 * back, which is safe because CORS is not the lock here: the key
 * is not a cookie, so no browser ever attaches it automatically
 * and a cross-site page cannot forge an authenticated call.
 */
const ALLOWED_ORIGINS: readonly string[] = (Deno.env.get('RAFFLE_ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

/** Fallback draw id when a caller omits one. The console sends DRAW_ID. */
const ENV_DRAW_ID = (Deno.env.get('RAFFLE_DRAW_ID') ?? '').trim();

/** A four character admin key is not an admin key. */
const MIN_ADMIN_KEY_LENGTH = 16;

/** Reject reasons reach the entrant through the raffle_receipt RPC. */
const MAX_REJECT_REASON_LENGTH = 280;

const CORS_ALLOW_HEADERS = 'authorization, x-client-info, apikey, content-type, x-raffle-key';

/* ------------------------------------------------------------
   Responses
   ------------------------------------------------------------ */

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOW_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    // The allowed origin varies per request, so caches must key on it.
    Vary: 'Origin',
  };

  if (ALLOWED_ORIGINS.length === 0) {
    headers['Access-Control-Allow-Origin'] = origin ?? '*';
  } else if (origin !== null && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // Origin present but not on the list: no allow header, browser blocks
  // the read. The key check below still runs and still has to pass.

  return headers;
}

function json(body: Record<string, unknown>, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function fail(error: string, status: number, origin: string | null): Response {
  return json({ ok: false, error }, status, origin);
}

/* ------------------------------------------------------------
   Constant time key comparison.

   Hash both sides with a random per instance HMAC key, then walk
   two fixed length digests. Length differences cannot leak,
   because every digest is 32 bytes, and an early return is
   impossible because the loop never breaks. A plain === on the
   raw strings would bail on the first wrong byte and hand an
   attacker a timing oracle for the key one character at a time.
   ------------------------------------------------------------ */

const COMPARE_SALT = crypto.getRandomValues(new Uint8Array(32));

async function digest(value: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    COMPARE_SALT,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return new Uint8Array(signature);
}

async function timingSafeEquals(a: string, b: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let diff = left.length ^ right.length;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
}

/* ------------------------------------------------------------
   Input validation. Nothing reaches the database until it has
   been through here, and nothing is ever string interpolated
   into SQL: every call below is an rpc argument or a query
   builder argument, which PostgREST sends as a bound parameter.
   ------------------------------------------------------------ */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trimmed string, or '' for anything that is not a string. */
function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------
   Row shapes. The client is untyped, so results are narrowed
   here rather than trusted.
   ------------------------------------------------------------ */

interface EntryStatusRow {
  id: string;
  draw_id: string;
  status: string;
}

interface DrawStatusRow {
  id: string;
  status: string;
}

/** What a refusal message is allowed to quote back at the caller. */
interface DrawContextRow {
  status: string | null;
  seed_source: string | null;
  seed_available_at: string | null;
  frozen_at: string | null;
}

interface VerifyResult {
  ticket_start: number;
  ticket_end: number;
}

interface FreezeResult {
  list_sha256: string;
  ticket_count: number;
}

interface DrawResult {
  winning_ticket: number;
  display_name: string;
  list_sha256: string;
}

interface DbError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

/** Postgres set returning functions arrive as an array of one row. */
function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] as T | undefined) ?? null;
  if (data === null || data === undefined) return null;
  return data as T;
}

/**
 * Server side only. Never returned to a caller, because a raw
 * Postgres message can carry row content with it.
 */
function logDbError(action: string, error: DbError): void {
  console.error(
    `[raffle-admin] ${action} failed`,
    JSON.stringify({ code: error.code ?? null, message: error.message, details: error.details ?? null }),
  );
}

function says(error: DbError, fragment: string): boolean {
  return error.message.toLowerCase().includes(fragment);
}

/* ------------------------------------------------------------
   Refusals.

   The three privileged functions defend the fairness of the draw
   by raising. Every one of those raises is a decision the coach
   has to understand while standing in a gym holding a phone, so
   every one of them is mapped here to plain English and an honest
   status code: 409 when the state says no, 400 when the input was
   wrong, 500 only for something nobody predicted.

   A known refusal that reaches him as a bare 500 is worse than no
   message at all. It tells him the site is broken at the exact
   moment the database has in fact just stopped him from doing
   something that would have made the raffle unprovable, and the
   difference between those two decides whether he retries, waits,
   or picks up the phone.

   The fragments below are matched against the LIVE function
   bodies, which are supabase/migrations/20260825b_raffle_hardening.sql
   as applied. Add a raise there and add its fragment here, and
   keep the fragments narrow enough that no two raises in the same
   function can match the same rule.
   ------------------------------------------------------------ */

/** Eastern time, because everything the coach reads is in it. */
const ET_ZONE = 'America/New_York';

/**
 * An instant written the way the rest of the site writes one: month,
 * day, then a lowercase clock time, in Eastern. Handed the draw row's
 * seed_available_at it reproduces FREEZE_DEADLINE_LABEL from
 * src/lib/raffleData.ts exactly, and that is the point. No date, time
 * or deadline is typed into this file. Every one the coach reads in a
 * refusal is rendered from the column the database is enforcing, so
 * the message and the rule cannot drift apart.
 */
export function etLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;

  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_ZONE,
    month: 'long',
    day: 'numeric',
  }).format(at);
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(at)
    .replace(/\s?AM$/, 'am')
    .replace(/\s?PM$/, 'pm');

  return `${day} at ${clock} ET`;
}

/** Live values from the draw row, used to make a refusal specific. */
interface DrawContext {
  readonly status: string | null;
  readonly seedSource: string | null;
  readonly seedAvailableLabel: string | null;
  readonly frozenAtLabel: string | null;
}

const NO_DRAW_CONTEXT: DrawContext = {
  status: null,
  seedSource: null,
  seedAvailableLabel: null,
  frozenAtLabel: null,
};

interface Refusal {
  readonly status: number;
  readonly message: string;
}

interface RefusalRule {
  /** Lowercase fragment, unique to one raise inside one function. */
  readonly fragment: string;
  /** True when the message quotes a live value off the draw row. */
  readonly needsDraw: boolean;
  readonly refuse: (draw: DrawContext) => Refusal;
}

/** Joins the sentences that are actually present. */
function sentences(parts: readonly (string | null)[]): string {
  return parts.filter((part): part is string => part !== null && part.length > 0).join(' ');
}

/* raffle_verify_entry */
const VERIFY_REFUSALS: readonly RefusalRule[] = [
  {
    // 'entry % is already verified'
    fragment: 'already verified',
    needsDraw: false,
    refuse: () => ({
      status: 409,
      message: 'That entry is already verified and already holds ticket numbers.',
    }),
  },
  {
    // 'draw % is % and can no longer issue tickets'
    fragment: 'can no longer issue tickets',
    needsDraw: true,
    // The status is only quoted when it still agrees with the refusal. A
    // row that reads 'open' on the follow up read cannot be the row that
    // just refused, and printing it would tell the coach the opposite of
    // what happened.
    refuse: (draw) => ({
      status: 409,
      message: `That draw is ${draw.status !== null && draw.status !== 'open' ? draw.status : 'no longer open'}. Its numbered list is already published, so no further tickets can be issued.`,
    }),
  },
  {
    // 'entry % not found'
    fragment: 'not found',
    needsDraw: false,
    refuse: () => ({ status: 404, message: 'No entry with that id.' }),
  },
];

/* raffle_freeze */
const FREEZE_REFUSALS: readonly RefusalRule[] = [
  {
    // 'refusing to freeze draw %: its seed (%) published at % and is already
    //  public. Sealing the list after the winning number exists would make
    //  the draw unprovable.'
    //
    // This is the refusal the entire hardening design exists to be able to
    // produce, so it gets the longest and plainest message in the file. It
    // has to say what happened, that the list can no longer be sealed at
    // all, and that nothing gets announced until a human who understands
    // the commitment has looked at it.
    fragment: 'is already public',
    needsDraw: true,
    refuse: (draw) => ({
      status: 409,
      message: sentences([
        'The seed number for this draw is already public, so this entry list can no longer be sealed.',
        draw.seedAvailableLabel === null
          ? 'It had to be sealed before the seed drawing published.'
          : `It had to be sealed before ${draw.seedAvailableLabel}, when the seed drawing published.`,
        'Sealing it now, after the winning number already exists, would make the draw impossible to prove fair, so the database refused.',
        'Do not run the draw and do not announce a winner. Contact whoever runs the site before you tell anybody anything.',
      ]),
    }),
  },
  {
    // 'refusing to freeze draw % with zero verified entries'
    fragment: 'zero verified entries',
    needsDraw: false,
    refuse: () => ({
      status: 409,
      message: 'There are no verified entries to freeze. Verify at least one paid entry first.',
    }),
  },
  {
    // 'draw % is % and cannot be frozen again'
    fragment: 'cannot be frozen again',
    needsDraw: true,
    refuse: (draw) => ({
      status: 409,
      message:
        draw.status === 'drawn'
          ? 'That draw has already been run, so its list cannot be frozen again.'
          : draw.status === null || draw.status === 'open'
            ? 'That draw was not open when the freeze ran, so it could not be sealed. A list is sealed once and never resealed.'
            : `That draw is ${draw.status}, so it cannot be frozen again. A list is sealed once and never resealed.`,
    }),
  },
  {
    // 'refusing to freeze: a display name contains a delimiter character'
    fragment: 'delimiter character',
    needsDraw: false,
    refuse: () => ({
      status: 409,
      message:
        'One of the verified display names contains a character that would make the sealed list ambiguous, so the freeze was refused. That name has to be corrected in the database before the list can be sealed.',
    }),
  },
  {
    // 'draw % does not exist'
    fragment: 'does not exist',
    needsDraw: false,
    refuse: () => ({ status: 404, message: 'No draw with that id.' }),
  },
];

/* raffle_execute_draw */
const DRAW_REFUSALS: readonly RefusalRule[] = [
  {
    // 'draw % was frozen at %, after its seed published at %. Refusing to draw.'
    fragment: 'after its seed published',
    needsDraw: true,
    refuse: (draw) => ({
      status: 409,
      message: sentences([
        'This list was sealed after its seed number was already public, so this draw cannot be proved fair and the database refused to run it.',
        draw.frozenAtLabel !== null && draw.seedAvailableLabel !== null
          ? `The list was sealed ${draw.frozenAtLabel} and the seed published ${draw.seedAvailableLabel}.`
          : null,
        'Do not announce a winner. Contact whoever runs the site before you tell anybody anything.',
      ]),
    }),
  },
  {
    // 'the seed for draw % does not publish until %. Refusing to draw early.'
    fragment: 'does not publish until',
    needsDraw: true,
    refuse: (draw) => ({
      status: 409,
      message:
        draw.seedAvailableLabel === null
          ? 'The seed number has not published yet, so the draw cannot run.'
          : sentences([
              `The seed number does not publish until ${draw.seedAvailableLabel}, so the draw cannot run yet.`,
              draw.seedSource === null
                ? 'Run it once the real number is public.'
                : `Run it once you can read the real number off the ${draw.seedSource}.`,
            ]),
    }),
  },
  {
    // 'seed source mismatch: this draw committed to "%" and cannot be drawn from "%"'
    fragment: 'seed source mismatch',
    needsDraw: true,
    refuse: (draw) => ({
      status: 409,
      message:
        draw.seedSource === null
          ? 'That is not the seed source this draw committed to, so the draw was refused.'
          : sentences([
              `That is not the seed source this draw committed to. It committed to the ${draw.seedSource}, and naming the source in advance is the whole point, so it cannot be swapped now.`,
              'Leave the seed source out of the request and the published one is used.',
            ]),
    }),
  },
  {
    // 'seed value is required'
    fragment: 'seed value is required',
    needsDraw: false,
    refuse: () => ({ status: 400, message: 'A seed value is required.' }),
  },
  {
    // 'draw % must be frozen before it can be drawn'. The lookup inside the
    // function selects on id AND status, so this one raise covers a missing
    // draw, a still open draw and a draw that already ran. The draw row is
    // what tells the three apart.
    fragment: 'must be frozen',
    needsDraw: true,
    refuse: (draw) => {
      if (draw.status === null) return { status: 404, message: 'No draw with that id.' };
      if (draw.status === 'drawn') {
        return { status: 409, message: 'That draw has already been run, and a draw runs once.' };
      }
      if (draw.status === 'frozen') {
        // It was not frozen when the draw ran, and it is now. Something
        // froze it in between, so this is a retry and not a dead end.
        return {
          status: 409,
          message: 'That draw was not frozen when the draw ran, so there was no sealed list to draw from. It is frozen now, so try again.',
        };
      }
      return {
        status: 409,
        message: `That draw is ${draw.status}, so there is no sealed list to draw from. Freeze the list first.`,
      };
    },
  },
];

/** First rule whose fragment appears in the message, or null. */
export function matchRefusal(rules: readonly RefusalRule[], error: DbError): RefusalRule | null {
  for (const rule of rules) {
    if (says(error, rule.fragment)) return rule;
  }
  return null;
}

/** Exported so the raise strings in the migration can be checked against it. */
export const RAFFLE_REFUSALS = {
  verify: VERIFY_REFUSALS,
  freeze: FREEZE_REFUSALS,
  draw: DRAW_REFUSALS,
} as const;

/**
 * Read only, and only on an error path. A failure here degrades the
 * message, never the status code, so a refusal still reads as a
 * refusal even if the follow up read is the thing that broke.
 */
async function drawContext(db: SupabaseClient, drawId: string): Promise<DrawContext> {
  const res = await db
    .from('raffle_draws')
    .select('status, seed_source, seed_available_at, frozen_at')
    .eq('id', drawId)
    .maybeSingle();

  if (res.error) {
    logDbError('context', res.error);
    return NO_DRAW_CONTEXT;
  }
  const row = res.data as DrawContextRow | null;
  if (row === null) return NO_DRAW_CONTEXT;

  return {
    status: str(row.status) || null,
    seedSource: str(row.seed_source) || null,
    seedAvailableLabel: etLabel(row.seed_available_at),
    frozenAtLabel: etLabel(row.frozen_at),
  };
}

/**
 * Log the raw error, then answer with the mapped refusal. Only a
 * message that matches no known raise gets the contentless 500.
 */
async function refuse(
  db: SupabaseClient,
  drawId: string,
  action: string,
  error: DbError,
  rules: readonly RefusalRule[],
  unexpected: string,
  origin: string | null,
): Promise<Response> {
  logDbError(action, error);

  const rule = matchRefusal(rules, error);
  if (rule === null) return fail(unexpected, 500, origin);

  const context = rule.needsDraw ? await drawContext(db, drawId) : NO_DRAW_CONTEXT;
  const { status, message } = rule.refuse(context);
  return fail(message, status, origin);
}

/* ------------------------------------------------------------
   Actions
   ------------------------------------------------------------ */

type Body = Record<string, unknown>;

/**
 * The full private row set. This is the one place full_name,
 * phone, email, venmo_handle and note leave the database, and it
 * is deliberate: it is what Coach checks against Venmo. It is
 * reachable only with the admin key, and it must never be
 * rendered on a public surface.
 */
async function actionList(
  db: SupabaseClient,
  drawId: string,
  origin: string | null,
): Promise<Response> {
  const [entriesRes, drawRes] = await Promise.all([
    db.from('raffle_entries').select('*').eq('draw_id', drawId).order('created_at', { ascending: true }),
    db.from('raffle_draws').select('*').eq('id', drawId).maybeSingle(),
  ]);

  if (entriesRes.error) {
    logDbError('list.entries', entriesRes.error);
    return fail('Could not read the entry list.', 500, origin);
  }
  if (drawRes.error) {
    logDbError('list.draw', drawRes.error);
    return fail('Could not read the draw.', 500, origin);
  }

  return json(
    {
      ok: true,
      drawId,
      draw: drawRes.data ?? null,
      entries: entriesRes.data ?? [],
    },
    200,
    origin,
  );
}

async function actionVerify(
  db: SupabaseClient,
  drawId: string,
  body: Body,
  origin: string | null,
): Promise<Response> {
  const entryId = str(body.entryId);
  if (!isUuid(entryId)) return fail('entryId must be a UUID.', 400, origin);

  const verifier = str(body.verifier) || 'admin';

  // raffle_verify_entry does not look at the draw status, so this is the
  // only place the frozen list can be defended. Minting a ticket after the
  // freeze would put a number on the public board that is not inside the
  // published fingerprint, and raffle_execute_draw could never pick it
  // because the draw divides by frozen_ticket_count. A late entry would
  // appear to be in the pool while having no chance of winning, which is
  // the exact thing the freeze exists to make impossible.
  const [entryRes, drawRes] = await Promise.all([
    db.from('raffle_entries').select('id, draw_id, status').eq('id', entryId).maybeSingle(),
    db.from('raffle_draws').select('id, status').eq('id', drawId).maybeSingle(),
  ]);

  if (entryRes.error) {
    logDbError('verify.entry', entryRes.error);
    return fail('Could not verify that entry.', 500, origin);
  }
  if (drawRes.error) {
    logDbError('verify.draw', drawRes.error);
    return fail('Could not verify that entry.', 500, origin);
  }

  const entry = entryRes.data as EntryStatusRow | null;
  if (entry === null || entry.draw_id !== drawId) {
    return fail('No entry with that id in this draw.', 404, origin);
  }

  const draw = drawRes.data as DrawStatusRow | null;
  if (draw === null) return fail('No draw with that id.', 404, origin);
  if (draw.status !== 'open') {
    return fail(
      `That draw is ${draw.status}. Its numbered list is already published, so no further tickets can be issued.`,
      409,
      origin,
    );
  }

  const { data, error } = await db.rpc('raffle_verify_entry', {
    p_entry_id: entryId,
    p_verifier: verifier,
  });

  if (error) {
    return await refuse(
      db,
      drawId,
      'verify',
      error,
      RAFFLE_REFUSALS.verify,
      'Could not verify that entry.',
      origin,
    );
  }

  const row = firstRow<VerifyResult>(data);
  if (row === null) return fail('Verify returned no ticket range.', 500, origin);

  return json(
    { ok: true, entryId, ticketStart: row.ticket_start, ticketEnd: row.ticket_end, verifiedBy: verifier },
    200,
    origin,
  );
}

/**
 * A verified entry is already on the public board with ticket
 * numbers next to it. Pulling it out would leave a hole in the
 * sequence, and closing that hole would renumber everybody after
 * it, which breaks the promise that tickets are assigned in
 * payment order and never reshuffled. So verified is terminal.
 *
 * The neq('status', 'verified') filter is the real guard: it makes
 * the check and the write one atomic statement, so a verify landing
 * between a read and a write cannot slip past it.
 */
async function actionReject(
  db: SupabaseClient,
  drawId: string,
  body: Body,
  origin: string | null,
): Promise<Response> {
  const entryId = str(body.entryId);
  if (!isUuid(entryId)) return fail('entryId must be a UUID.', 400, origin);

  const reason = str(body.reason);
  if (reason.length === 0) return fail('A reject reason is required.', 400, origin);
  if (reason.length > MAX_REJECT_REASON_LENGTH) {
    return fail(`A reject reason must be ${MAX_REJECT_REASON_LENGTH} characters or fewer.`, 400, origin);
  }

  const { data, error } = await db
    .from('raffle_entries')
    .update({ status: 'rejected', reject_reason: reason })
    .eq('id', entryId)
    .eq('draw_id', drawId)
    .neq('status', 'verified')
    .select('id, draw_id, status');

  if (error) {
    logDbError('reject', error);
    return fail('Could not reject that entry.', 500, origin);
  }

  const updated = (data ?? []) as EntryStatusRow[];
  if (updated.length === 0) {
    // Nothing moved. Either the entry does not exist, or it is verified.
    const existing = await db
      .from('raffle_entries')
      .select('id, draw_id, status')
      .eq('id', entryId)
      .eq('draw_id', drawId)
      .maybeSingle();
    if (existing.error) {
      logDbError('reject.lookup', existing.error);
      return fail('Could not reject that entry.', 500, origin);
    }
    const row = existing.data as EntryStatusRow | null;
    if (row === null) return fail('No entry with that id in this draw.', 404, origin);
    return fail(
      'That entry is already verified. Its ticket numbers are on the public board, and pulling it out would renumber every ticket issued after it. Verified entries cannot be rejected.',
      409,
      origin,
    );
  }

  return json({ ok: true, entryId, status: 'rejected', reason }, 200, origin);
}

async function actionFreeze(db: SupabaseClient, drawId: string, origin: string | null): Promise<Response> {
  const { data, error } = await db.rpc('raffle_freeze', { p_draw_id: drawId });

  if (error) {
    return await refuse(
      db,
      drawId,
      'freeze',
      error,
      RAFFLE_REFUSALS.freeze,
      'Could not freeze that draw.',
      origin,
    );
  }

  const row = firstRow<FreezeResult>(data);
  if (row === null) return fail('Freeze returned no fingerprint.', 500, origin);

  return json(
    { ok: true, drawId, listSha256: row.list_sha256, ticketCount: row.ticket_count },
    200,
    origin,
  );
}

/**
 * seedSource defaults to the value already published on the draw
 * row, which is what makes the commitment credible: the source was
 * named before anybody knew the number.
 */
async function actionDraw(
  db: SupabaseClient,
  drawId: string,
  body: Body,
  origin: string | null,
): Promise<Response> {
  const seedValue = str(body.seedValue);
  if (seedValue.length === 0) return fail('seedValue is required.', 400, origin);

  let seedSource = str(body.seedSource);
  if (seedSource.length === 0) {
    const published = await db.from('raffle_draws').select('seed_source').eq('id', drawId).maybeSingle();
    if (published.error) {
      logDbError('draw.seedSource', published.error);
      return fail('Could not read the published seed source.', 500, origin);
    }
    const row = published.data as { seed_source: string | null } | null;
    seedSource = str(row?.seed_source);
  }
  if (seedSource.length === 0) {
    return fail('seedSource is required, and this draw has none published.', 400, origin);
  }

  const { data, error } = await db.rpc('raffle_execute_draw', {
    p_draw_id: drawId,
    p_seed_source: seedSource,
    p_seed_value: seedValue,
  });

  if (error) {
    return await refuse(db, drawId, 'draw', error, RAFFLE_REFUSALS.draw, 'Could not run that draw.', origin);
  }

  const row = firstRow<DrawResult>(data);
  if (row === null) return fail('The draw returned no winning ticket.', 500, origin);

  return json(
    {
      ok: true,
      drawId,
      winningTicket: row.winning_ticket,
      displayName: row.display_name,
      listSha256: row.list_sha256,
      seedSource,
      seedValue,
    },
    200,
    origin,
  );
}

async function actionVideo(
  db: SupabaseClient,
  drawId: string,
  body: Body,
  origin: string | null,
): Promise<Response> {
  const videoUrl = str(body.videoUrl);
  if (videoUrl.length === 0) return fail('videoUrl is required.', 400, origin);
  if (!isHttpUrl(videoUrl)) return fail('videoUrl must be an http or https URL.', 400, origin);

  const { data, error } = await db
    .from('raffle_draws')
    .update({ draw_video_url: videoUrl })
    .eq('id', drawId)
    .select('id, draw_video_url');

  if (error) {
    logDbError('video', error);
    return fail('Could not save that video URL.', 500, origin);
  }
  if ((data ?? []).length === 0) return fail('No draw with that id.', 404, origin);

  return json({ ok: true, drawId, videoUrl }, 200, origin);
}

/* ------------------------------------------------------------
   Handler
   ------------------------------------------------------------ */

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');

  // Preflight carries no key and no body. Answer it before the
  // configuration check, so a misconfigured function reports a
  // readable 503 to the console instead of an opaque CORS error.
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    if (req.method !== 'POST') {
      return fail('Use POST.', 405, origin);
    }

    /* ---- configuration. No key, no service. No default key, ever. ---- */
    if (ADMIN_KEY.length === 0) {
      console.error('[raffle-admin] refusing every request: RAFFLE_ADMIN_KEY is not set');
      return fail('raffle-admin is not configured.', 503, origin);
    }
    if (ADMIN_KEY.length < MIN_ADMIN_KEY_LENGTH) {
      console.error(
        `[raffle-admin] refusing every request: RAFFLE_ADMIN_KEY is shorter than ${MIN_ADMIN_KEY_LENGTH} characters`,
      );
      return fail('raffle-admin is not configured.', 503, origin);
    }
    if (SUPABASE_URL.length === 0 || SERVICE_ROLE_KEY.length === 0) {
      console.error('[raffle-admin] refusing every request: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
      return fail('raffle-admin is not configured.', 503, origin);
    }

    /* ---- the gate ---- */
    // A missing header is compared as '' rather than short circuited,
    // so absent and wrong take the same path and the same time. The
    // body is identical for both, so neither the caller nor a stopwatch
    // learns which one it was.
    const presented = req.headers.get('x-raffle-key') ?? '';
    if (!(await timingSafeEquals(presented, ADMIN_KEY))) {
      return fail('Not authorized.', 401, origin);
    }

    /* ---- body ---- */
    let body: Body;
    try {
      const parsed: unknown = await req.json();
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fail('Body must be a JSON object.', 400, origin);
      }
      body = parsed as Body;
    } catch {
      return fail('Body must be valid JSON.', 400, origin);
    }

    const action = str(body.action).toLowerCase();
    if (action.length === 0) return fail('action is required.', 400, origin);

    const drawId = str(body.drawId) || ENV_DRAW_ID;
    if (drawId.length === 0) {
      return fail('drawId is required. Send DRAW_ID from src/lib/raffleData.ts.', 400, origin);
    }
    if (drawId.length > 100) return fail('drawId is too long.', 400, origin);

    /* ---- service role, created only after the key has cleared ---- */
    const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-raffle-admin': 'edge' } },
    });

    switch (action) {
      case 'list':
        return await actionList(db, drawId, origin);
      case 'verify':
        return await actionVerify(db, drawId, body, origin);
      case 'reject':
        return await actionReject(db, drawId, body, origin);
      case 'freeze':
        return await actionFreeze(db, drawId, origin);
      case 'draw':
        return await actionDraw(db, drawId, body, origin);
      case 'video':
        return await actionVideo(db, drawId, body, origin);
      default:
        return fail('Unknown action.', 400, origin);
    }
  } catch (err) {
    // Server side only. The caller gets a short, contentless message.
    console.error('[raffle-admin] unhandled', err instanceof Error ? err.stack ?? err.message : String(err));
    return fail('Something went wrong.', 500, origin);
  }
});
