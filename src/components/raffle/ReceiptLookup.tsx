/* ============================================================
   RECEIPT LOOKUP
   One entrant, one code, one row. Goes through lookupReceipt in
   useRaffle.ts, which calls the security-definer RPC. Nothing
   here can see anyone else's entry, and nothing here can see a
   name, a phone number or a note.
   ============================================================ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RAFFLE_CONTACT,
  formatTicketRange,
  type RaffleDraw,
  type RaffleReceipt,
} from '../../lib/raffleData';
import { lookupReceipt, useRaffleDraw } from '../../lib/useRaffle';

const ease = [0.16, 1, 0.3, 1] as const;

const CONTACT_FIRST = RAFFLE_CONTACT.name.split(' ')[0];

/** Codes are six characters. A little slack for a pasted code with a stray space. */
const MAX_CODE_CHARS = 12;

type LookupState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'error'; message: string }
  | { kind: 'missing'; code: string }
  | { kind: 'found'; receipt: RaffleReceipt; code: string };

/** ISO instant to something a parent reads, in their own time zone. */
function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function CoachLine({ lead }: { lead: string }) {
  return (
    <p className="text-sm text-white/60 font-body leading-relaxed">
      {lead} Coach {RAFFLE_CONTACT.name} at{' '}
      <a
        href={`tel:${RAFFLE_CONTACT.phoneRaw}`}
        className="text-gold-400 hover:text-gold-300 underline underline-offset-2 whitespace-nowrap"
      >
        {RAFFLE_CONTACT.phone}
      </a>
      .
    </p>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function StatusPill({ tone, children }: { tone: 'amber' | 'gold' | 'red'; children: string }) {
  const toneClass =
    tone === 'gold'
      ? 'bg-gold-500 text-navy-900'
      : tone === 'amber'
        ? 'bg-amber-400/25 text-amber-100 border border-amber-300/60'
        : 'bg-red-500/15 text-red-200 border border-red-400/40';
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full font-accent uppercase tracking-[0.15em] text-[11px] font-bold ${toneClass}`}
    >
      {children}
    </span>
  );
}

/**
 * The pending entry that never got confirmed, seen after the list was sealed.
 * The database refuses to add to a frozen list, so this person is not waiting
 * on anything and must not be told otherwise. The one useful thing left is the
 * receipt code and the coach's number.
 */
function SealedOutResult({
  receipt,
  code,
  draw,
  ticketsLabel,
}: {
  receipt: RaffleReceipt;
  code: string;
  draw: RaffleDraw;
  ticketsLabel: string;
}) {
  const sealedWhen = formatWhen(draw.frozen_at);

  return (
    <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-5">
      <StatusPill tone="red">Not in the drawing</StatusPill>
      <p className="mt-3 text-white font-body">
        <span className="font-semibold">{receipt.display_name}</span>, {ticketsLabel}.
      </p>
      <p className="mt-1.5 text-sm text-red-100 font-body leading-relaxed">
        This entry was never confirmed, and the numbered list was sealed without it
        {sealedWhen ? ` on ${sealedWhen}` : ''}. Nothing can be added to a sealed
        list, so it has no ticket number and it is not in the drawing
        {draw.status === 'drawn' ? ', which has already been held' : ''}.
      </p>
      <p className="mt-2.5 text-sm text-white/70 font-body leading-relaxed">
        Do not submit it again. Text Coach {CONTACT_FIRST} this receipt code so he can
        look into it:
      </p>
      <p className="mt-2 font-mono tracking-[0.2em] text-lg text-gold-300 break-all select-all">
        {code}
      </p>
      <div className="mt-3">
        <CoachLine lead="Send it to" />
      </div>
    </div>
  );
}

function ReceiptResult({
  receipt,
  code,
  draw,
}: {
  receipt: RaffleReceipt;
  code: string;
  draw: RaffleDraw | null;
}) {
  const ticketsLabel = receipt.chances === 1 ? '1 ticket' : `${receipt.chances} tickets`;

  if (receipt.status === 'verified') {
    // Local consts so TypeScript narrows both through the ternary below.
    const start = receipt.ticket_start;
    const end = receipt.ticket_end;
    const hasTickets = start !== null && end !== null;
    return (
      <div className="rounded-xl border border-gold-500/50 bg-gold-500/10 p-5 text-center">
        <StatusPill tone="gold">Confirmed</StatusPill>
        <p className="mt-3 font-accent uppercase tracking-[0.2em] text-[11px] text-white/50">
          {hasTickets ? (receipt.chances === 1 ? 'Your ticket number' : 'Your ticket numbers') : 'Your entry'}
        </p>
        <p className="mt-1 text-stadium text-5xl sm:text-6xl text-gold-400 glow-gold-subtle break-words">
          {hasTickets ? formatTicketRange(start, end) : ticketsLabel}
        </p>
        <p className="mt-2 text-sm text-white/70 font-body">
          <span className="text-white font-semibold">{receipt.display_name}</span>, {ticketsLabel}.
          You are on the board.
        </p>
      </div>
    );
  }

  if (receipt.status === 'pending') {
    /* The draw is the difference between "hold tight" and "this is over".
       While the draw row has not loaded we do not know which, so we say the
       softer of the two rather than guess. */
    if (draw && draw.status !== 'open') {
      return (
        <SealedOutResult receipt={receipt} code={code} draw={draw} ticketsLabel={ticketsLabel} />
      );
    }

    return (
      <div className="rounded-xl border border-amber-300/60 bg-amber-400/15 p-5">
        <StatusPill tone="amber">Pending</StatusPill>
        <p className="mt-3 text-white font-body">
          <span className="font-semibold">{receipt.display_name}</span>, {ticketsLabel}.
        </p>
        <p className="mt-1.5 text-sm text-white/70 font-body leading-relaxed">
          We have your entry and are waiting on payment confirmation. Coach {CONTACT_FIRST} checks
          it against the Venmo account by hand. Ticket numbers show up here, and on the board, the
          moment it clears.
        </p>
        <div className="mt-3">
          <CoachLine lead="Sent it a while ago? Text" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-5">
      <StatusPill tone="red">Rejected</StatusPill>
      <p className="mt-3 text-white font-body">
        <span className="font-semibold">{receipt.display_name}</span>, {ticketsLabel}.
      </p>
      {receipt.reject_reason ? (
        <p className="mt-1.5 text-sm text-red-100 font-body leading-relaxed">
          {receipt.reject_reason}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-red-100 font-body leading-relaxed">
          This entry was marked rejected without a reason written down.
        </p>
      )}
      <div className="mt-3">
        <CoachLine lead="If that looks wrong, text" />
      </div>
    </div>
  );
}

export default function ReceiptLookup() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<LookupState>({ kind: 'idle' });
  /* A pending receipt means something different once the list is sealed, so
     this surface has to know the draw status, not just the entry status. */
  const { draw } = useRaffleDraw();

  const checking = state.kind === 'checking';

  async function handleCheck(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (checking) return;

    // The same normalisation lookupReceipt applies, so what we echo back at
    // the entrant is the code the lookup actually ran on.
    const clean = code.trim().toUpperCase();

    setState({ kind: 'checking' });
    const result = await lookupReceipt(code);

    if (!result.ok) {
      // Written for a parent to read. Shown as-is.
      setState({ kind: 'error', message: result.error });
      return;
    }
    if (!result.receipt) {
      setState({ kind: 'missing', code: clean });
      return;
    }
    setState({ kind: 'found', receipt: result.receipt, code: clean });
  }

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease }}
      className="card-electric rounded-2xl p-5 sm:p-7"
    >
      <h3 className="text-stadium text-3xl sm:text-4xl text-gradient-gold">Check your entry</h3>
      <p className="mt-1.5 text-sm text-white/60 font-body leading-relaxed">
        Enter the receipt code you got when you submitted your entry.
      </p>

      <form onSubmit={(e) => void handleCheck(e)} className="mt-4 flex flex-col sm:flex-row gap-2.5">
        <label htmlFor="receipt-code" className="sr-only">
          Receipt code
        </label>
        <input
          id="receipt-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={MAX_CODE_CHARS}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\s+/g, '').toUpperCase().slice(0, MAX_CODE_CHARS));
            if (state.kind !== 'idle') setState({ kind: 'idle' });
          }}
          placeholder="ABC123"
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white text-xl font-mono tracking-[0.2em] text-center sm:text-left placeholder:text-white/20 placeholder:tracking-[0.2em] focus:outline-none focus:border-gold-500/50 transition-colors"
        />
        <button
          type="submit"
          disabled={checking || code.length === 0}
          className={`shrink-0 px-6 py-3.5 rounded-xl font-accent uppercase tracking-wider text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            checking
              ? 'bg-gold-500/40 text-navy-900/70 cursor-wait'
              : code.length === 0
                ? 'bg-white/5 text-white/25 cursor-not-allowed'
                : 'bg-gold-500 text-navy-900 hover:bg-gold-400 active:scale-[0.98]'
          }`}
        >
          {checking && <Spinner className="w-4 h-4 animate-spin" />}
          {checking ? 'Checking' : 'Check'}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {state.kind !== 'idle' && state.kind !== 'checking' && (
          <motion.div
            key={state.kind === 'found' ? `found-${state.receipt.status}` : state.kind}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease }}
            className="mt-4"
            role="status"
          >
            {state.kind === 'error' && (
              <div className="rounded-xl border border-red-400/40 bg-red-500/10 p-5">
                <p className="text-sm text-red-200 font-body leading-relaxed">{state.message}</p>
              </div>
            )}

            {state.kind === 'missing' && (
              <div className="rounded-xl border border-white/15 bg-white/5 p-5">
                <p className="text-white font-body">
                  We do not have an entry with that code.
                </p>
                <p className="mt-1.5 text-sm text-white/60 font-body leading-relaxed">
                  Check{' '}
                  <span className="font-mono tracking-widest text-white/80">{state.code}</span> for
                  a typo. The code has no letter I, L, O or U in it, so a 1 is a one and a 0 is a
                  zero.
                </p>
                <div className="mt-3">
                  <CoachLine lead="Still stuck? Text" />
                </div>
              </div>
            )}

            {state.kind === 'found' && (
              <ReceiptResult receipt={state.receipt} code={state.code} draw={draw} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
