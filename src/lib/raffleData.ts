/* ============================================================
   LOUISVILLE LIGHTNING - RAFFLE CONTRACT
   ------------------------------------------------------------
   Single source of truth for the raffle. Every raffle surface
   (public page, ticket board, admin console, edge function,
   flyer generator) reads from HERE. Nothing about the raffle is
   hard-coded anywhere else.

   Mirrors supabase/migrations/20260825_create_raffle.sql.
   If you change a column name here, change it there too.
   ============================================================ */

/* ---------- the draw ---------- */

export const DRAW_ID = 'glove-2026-10-01';

export const PRIZE = {
  name: 'Rawlings Heart of the Hide R2G',
  /** Read straight off the thumb stamp: PROR204U-4CM, 11 1/2 INCH. */
  size: '11.5 inch',
  model: 'PROR204U-4CM',
  colorway: 'Camel / mint green lace / pink trim',
  /**
   * Rendered as "a $XXX glove" social proof. Still 0 on purpose: nobody has
   * confirmed a real number, and printing a price on a raffle is a value claim
   * made to people handing over money. Leave it until Taylor confirms.
   */
  retailUsd: 0,
  photos: [
    { src: '/assets/raffle/glove-palm.jpg', alt: 'Rawlings Heart of the Hide R2G glove, palm side, mint green lacing and pink trim' },
    { src: '/assets/raffle/glove-web.jpg', alt: 'The same glove from the web side, showing the modified trap-eze web and Ready-2-Go hang tag' },
  ],
} as const;

/**
 * $10 = 1 ticket. Amount sent must equal tickets x this.
 *
 * The word is TICKETS everywhere a person can read it. The database column is
 * still named `chances` because renaming a live column mid-raffle buys nothing
 * and risks everything; it is never rendered.
 */
export const PRICE_PER_TICKET_CENTS = 1000;
export const MAX_TICKETS_PER_ENTRY = 100;

/** Entries close the night before. ET, expressed as a real UTC instant. */
export const ENTRIES_CLOSE_AT = '2026-10-01T03:59:00Z'; // Sep 30 11:59pm ET
export const DRAW_AT = '2026-10-01T23:00:00Z';          // Oct 1  7:00pm ET
/**
 * When the seed drawing publishes, and therefore the LAST moment the entry
 * list can legitimately be frozen. Mirrors raffle_draws.seed_available_at,
 * which enforces it: the database refuses a freeze at or after this instant.
 * The coach's console must show this, not the draw time. They are 5h40m apart.
 */
export const SEED_AVAILABLE_AT = '2026-10-01T17:20:00Z'; // Oct 1 1:20pm ET
export const FREEZE_DEADLINE_LABEL = 'October 1 at 1:20pm ET';

export const DRAW_DATE_LABEL = 'October 1st';
export const ENTRIES_CLOSE_LABEL = 'September 30 at 11:59pm ET';
export const DRAW_TIME_LABEL = 'October 1 at 7:00pm ET';

/**
 * The public, unpredictable number the winning ticket is derived from.
 * Published BEFORE the draw so nobody can claim the pick was steered.
 */
export const SEED_SOURCE_LABEL = 'Kentucky Pick 3 MIDDAY drawing, October 1, 2026';

/* ---------- money in ---------- */

export const VENMO = {
  displayName: 'Louisville Lightning Yellow',
  /** Venmo's own QR target, straight off Taylor's profile. */
  codeUrl: 'https://venmo.com/code?user_id=4667355036648975849&created=1787160475.927356&printed=1',
  qrImage: '/assets/raffle/venmo-qr.png',
  /**
   * NOT RENDERED ANYWHERE, deliberately. Brandon took the owner's name off the
   * public page 2026-08-27: the Venmo card is white and yellow and says
   * "Louisville Lightning Yellow", and that plus the QR is the whole
   * verification a person needs. Kept here so whoever picks this up later
   * knows whose account the money lands in. Do not put it back on the page.
   */
  accountOwner: 'Taylor Davis',
} as const;

/* ---------- who to call ---------- */

export const RAFFLE_CONTACT = {
  name: 'Aaron Quesenberry',
  role: 'Coach',
  phone: '(270) 268-8311',
  phoneRaw: '+12702688311',
} as const;

export const RAFFLE_URL = 'https://loulightning.com/raffle';
export const RAFFLE_QR_IMAGE = '/assets/raffle/raffle-qr.png';

/* ---------- the rules, as shown to entrants ---------- */

export const RAFFLE_RULES: readonly string[] = [
  `$10 a ticket, any multiple. $30 is 3 tickets, $50 is 5. Up to ${MAX_TICKETS_PER_ENTRY} on one entry.`,
  `Venmo first, then the form. One without the other is not an entry.`,
  `We match every payment by hand, then your numbers post on the board. Give us a few hours.`,
  `Numbers are handed out in the order payments clear, starting at #1. Nothing skipped, nothing held back.`,
  `Entries close ${ENTRIES_CLOSE_LABEL}. The list is then locked and a fingerprint of it published here, before the ${SEED_SOURCE_LABEL} happens. The database refuses to lock the list once that number exists, so it cannot be arranged around the answer.`,
  `The drawing is ${DRAW_TIME_LABEL}, on video, posted here. The winning number comes from that public lottery number, so anyone can check the math.`,
  `Made a mistake? Do not re-submit, that makes a second entry. Send us your receipt code and we will fix it.`,
  `The board shows a first name and a masked last initial. Your phone, email and full name are never public.`,
  `Winner is posted here and contacted directly. Questions go to the number at the bottom of this page.`,
];

/* ---------- data contract (matches the SQL exactly) ---------- */

export type RaffleStatus = 'pending' | 'verified' | 'rejected';
export type DrawStatus = 'open' | 'frozen' | 'drawn';

/** What the PUBLIC is allowed to read. No name, no phone, no email, ever. */
export interface RaffleBoardRow {
  display_name: string;   // "Sarah M***"
  ticket_start: number;
  ticket_end: number;
  chances: number;
  created_at: string;
}

/** What a person sees when they look up their OWN receipt code. */
export interface RaffleReceipt {
  status: RaffleStatus;
  display_name: string;
  chances: number;
  ticket_start: number | null;
  ticket_end: number | null;
  reject_reason: string | null;
}

/** What the entry form sends. Server rejects anything else. */
export interface RaffleEntryInput {
  draw_id: string;
  receipt_code: string;
  full_name: string;
  display_name: string;
  phone: string;
  email: string;
  chances: number;
  amount_cents: number;
  venmo_handle: string;
  note: string;
}

export interface RaffleDraw {
  id: string;
  title: string;
  status: DrawStatus;
  entries_close_at: string;
  draw_at: string;
  /** When the named seed drawing publishes. The freeze must precede it. */
  seed_available_at: string;
  frozen_at: string | null;
  frozen_list_sha256: string | null;
  /** The divisor in the winner calculation. Part of the commitment. */
  frozen_ticket_count: number | null;
  drawn_at: string | null;
  winning_ticket: number | null;
  seed_source: string | null;
  seed_value: string | null;
  draw_video_url: string | null;
  created_at: string;
}

/* ---------- helpers ---------- */

/**
 * "Sarah Mitchell" -> "Sarah M***"
 *
 * The ONLY name that ever reaches a public surface. The asterisks are the
 * point: a bare "Sarah M." reads like a truncation people assume the site
 * could un-truncate, and Brandon asked for visible masking. The first name
 * stays so an entrant can still find their own row next to their numbers.
 *
 * Falls back to "Lightning Fan" rather than ever echoing an unparseable
 * string onto the page.
 */
export function toDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Lightning Fan';

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const first = cap(parts[0]);

  // A single token is the dangerous case: whatever it is gets published
  // verbatim. People do type an email address or a phone number into a name
  // field, and RAFFLE_RULES promises them only a first name and an initial.
  // Anything that does not look like a name falls back rather than echoing.
  if (parts.length === 1) {
    const looksUnsafe =
      parts[0].includes('@') || /\d{3}/.test(parts[0]) || parts[0].length > 20;
    return looksUnsafe ? 'Lightning Fan' : first;
  }

  const initial = parts[parts.length - 1].charAt(0).toUpperCase();
  const out = `${first} ${initial}***`;
  // The DB caps display_name at 40 characters and refuses pipes, angle
  // brackets and control characters. Never hand it a value it will reject.
  // eslint-disable-next-line no-control-regex
  if (out.length > 40 || /[|<>\u0000-\u001F]/.test(out)) return 'Lightning Fan';
  return out;
}

/** Crockford-ish base32: no I, L, O, U - nothing a person can mis-read aloud. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateReceiptCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

export function ticketsToCents(tickets: number): number {
  return tickets * PRICE_PER_TICKET_CENTS;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** "#12" for a single ticket, "#12-14" for a block. */
export function formatTicketRange(start: number, end: number): string {
  return start === end ? `#${start}` : `#${start}-${end}`;
}
