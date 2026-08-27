/* ============================================================
   RAFFLE ENTRY FORM
   The half of the transaction that happens on this site. The
   other half is a Venmo payment, which is why the amount to
   send is the loudest thing on the card.

   Every rule, price, date, phone number and URL in here comes
   from raffleData.ts. Supabase is reached only through
   useRaffle.ts.

   This component gates ITSELF. The page it sits on hides the
   entry CTA once entries close, but a deep link to #enter, a
   bookmarked scroll position or a tab left open overnight all
   reach this component directly, so the deadline has to be
   enforced here or not at all.
   ============================================================ */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DRAW_TIME_LABEL,
  ENTRIES_CLOSE_AT,
  ENTRIES_CLOSE_LABEL,
  MAX_TICKETS_PER_ENTRY,
  PRICE_PER_TICKET_CENTS,
  RAFFLE_CONTACT,
  VENMO,
  ticketsToCents,
  formatUsd,
  toDisplayName,
} from '../../lib/raffleData';
import {
  submitRaffleEntry,
  useCountdown,
  useRaffleDraw,
  type SubmitResult,
} from '../../lib/useRaffle';

const ease = [0.16, 1, 0.3, 1] as const;

/* Mirrors the CHECK constraints in 20260825_create_raffle.sql.
   These live here as well as in the SQL so an over-long field is
   caught with a plain sentence next to the field, instead of
   tripping the RLS predicate and coming back as "entries closed". */
const MAX_NAME_CHARS = 80;
const MAX_DISPLAY_NAME_CHARS = 40;
const MAX_NOTE_CHARS = 280;

/** Convenience only. The price itself is PRICE_PER_TICKET_CENTS. */
const QUICK_PICKS = [1, 2, 3, 5, 10] as const;

const CONTACT_FIRST = RAFFLE_CONTACT.name.split(' ')[0];

/* text-base, not text-sm: anything under 16px makes iOS Safari zoom
   the viewport the moment the field is focused. */
const FIELD_CLASS =
  'w-full px-4 py-3 rounded-xl bg-navy-700 border border-white/10 text-white text-base placeholder:text-white/25 focus:outline-none focus:border-gold-500/50 transition-colors';
const LABEL_CLASS =
  'block text-xs font-accent uppercase tracking-wider text-white/45 mb-1.5';

interface FieldErrors {
  fullName?: string;
  phone?: string;
  tickets?: string;
}

interface SuccessState {
  receiptCode: string;
  displayName: string;
  amountCents: number;
}

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-red-300 font-body">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------
   What the form is replaced by once entries close. Deliberately
   renders NO inputs: a disabled form still reads as "fill this
   out", and step 1 of the flow is to Venmo the money first. The
   database refuses the insert that would follow, so the money
   would be gone with nothing to show for it.
   ------------------------------------------------------------ */
function EntriesClosedCard({ drawn }: { drawn: boolean }) {
  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      className="card-electric rounded-2xl p-5 sm:p-7"
    >
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gold-500/15 flex items-center justify-center">
          <BoltIcon className="w-7 h-7 text-gold-400" />
        </div>
        <h3 className="text-stadium text-3xl sm:text-4xl text-gradient-gold">Entries are closed</h3>
        <p className="mt-2 text-white/70 text-sm font-body leading-relaxed">
          Entries closed {ENTRIES_CLOSE_LABEL}, and the form closed with them. Nothing sent on
          Venmo after that time can be added to this raffle.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-gold-500/40 bg-navy-900/60 p-4">
        <p className="font-accent uppercase tracking-[0.2em] text-[11px] text-white/45">
          Sent the money but never got a receipt code
        </p>
        <p className="mt-1.5 text-sm text-white/75 font-body leading-relaxed">
          Do not send anything else. Text Coach {CONTACT_FIRST} at{' '}
          <a
            href={`tel:${RAFFLE_CONTACT.phoneRaw}`}
            className="text-gold-400 hover:text-gold-300 underline underline-offset-2 whitespace-nowrap"
          >
            {RAFFLE_CONTACT.phone}
          </a>{' '}
          and he will sort it out by hand.
        </p>
      </div>

      <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
        <p className="text-sm text-white/75 font-body leading-relaxed">
          {drawn
            ? 'The drawing has been made. The winning number and the recording are posted on this page.'
            : `The full numbered list gets frozen and its fingerprint published on this page. The drawing is ${DRAW_TIME_LABEL}, it is recorded, and the video goes up here afterwards.`}
        </p>
        <p className="text-sm text-white/60 font-body leading-relaxed">
          Already entered? Your ticket numbers appear on the board as soon as Coach {CONTACT_FIRST}{' '}
          matches your payment.
        </p>
      </div>

      <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
        <a
          href="#board"
          className="btn-lightning-outline text-sm flex-1 inline-flex items-center justify-center gap-2"
        >
          See the board
        </a>
        <a
          href="#receipt"
          className="btn-lightning-outline text-sm flex-1 inline-flex items-center justify-center gap-2"
        >
          Check your entry
        </a>
      </div>
    </motion.div>
  );
}

/* Held up while the draw row is still in flight. The form is never painted
   before the answer lands: a live form that vanishes a beat later is exactly
   long enough for somebody to start a payment. */
function FormSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the entry form"
      className="card-electric rounded-2xl p-5 sm:p-7 space-y-5"
    >
      <div className="h-9 w-56 max-w-full rounded bg-white/10 animate-pulse" />
      <div className="h-4 w-72 max-w-full rounded bg-white/5 animate-pulse" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
          <div className="h-12 w-full rounded-xl bg-white/10 animate-pulse" />
        </div>
      ))}
      <div className="h-28 w-full rounded-xl bg-white/5 animate-pulse" />
      <div className="h-14 w-full rounded-xl bg-white/10 animate-pulse" />
    </div>
  );
}

export default function RaffleEntryForm() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ticketsText, setTicketsText] = useState('1');
  const [venmoHandle, setVenmoHandle] = useState('');
  const [note, setNote] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  /* THE GATE. Entries close at ENTRIES_CLOSE_AT, which is 19 hours before the
     drawing, and the database stops accepting inserts at that instant. The
     draw row is the authority over the local clock, so a device set to the
     wrong day cannot talk its way into a live form. */
  const { draw, loading: drawLoading } = useRaffleDraw();
  const entriesLeft = useCountdown(ENTRIES_CLOSE_AT);
  const entriesClosed = entriesLeft === null || (draw !== null && draw.status !== 'open');

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const ticketsRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  /* The submitting flag is state, so two Enter presses inside one tick would
     both read it as false. This ref flips synchronously and is the actual
     lock on a double submit. */
  const inFlight = useRef(false);

  /* The form is replaced by the success panel, so move focus to it or a
     screen reader is left reading a page that silently changed. */
  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  const parsed = Number.parseInt(ticketsText, 10);
  const chances = Number.isFinite(parsed) ? parsed : 0;
  /* Not clamped: the amount always describes the number actually in the
     box, so the big gold number can never contradict the input. Out of
     range is caught by validation instead. */
  const amountCents = ticketsToCents(Math.max(chances, 0));
  const trimmedName = fullName.trim();
  const derivedDisplayName = toDisplayName(fullName);

  function clearError(field: keyof FieldErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function bumpTickets(delta: number) {
    const base = Number.isFinite(parsed) ? parsed : 0;
    const next = Math.min(Math.max(base + delta, 1), MAX_TICKETS_PER_ENTRY);
    setTicketsText(String(next));
    clearError('tickets');
  }

  /** Mirrors the guards in submitRaffleEntry and the SQL CHECKs. */
  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (trimmedName.length < 2) {
      next.fullName = 'Enter your first and last name.';
    } else if (trimmedName.length > MAX_NAME_CHARS) {
      next.fullName = `That name is longer than ${MAX_NAME_CHARS} characters. Shorten it and try again.`;
    } else if (derivedDisplayName.length > MAX_DISPLAY_NAME_CHARS) {
      next.fullName = 'That first name is too long for the public board. Use a shorter version of it.';
    }

    if (phone.replace(/\D/g, '').length < 10) {
      next.phone = 'We need a phone number to reach you if you win.';
    }

    if (!Number.isFinite(parsed) || chances < 1) {
      next.tickets = 'Choose at least one ticket.';
    } else if (!Number.isInteger(chances)) {
      next.tickets = 'Tickets have to be a whole number.';
    } else if (chances > MAX_TICKETS_PER_ENTRY) {
      next.tickets = `Maximum ${MAX_TICKETS_PER_ENTRY} tickets in a single entry.`;
    }

    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current || submitting || success) return; // no double submit, ever

    const found = validate();
    setErrors(found);
    setFormError(null);

    if (found.fullName) {
      nameRef.current?.focus();
      return;
    }
    if (found.phone) {
      phoneRef.current?.focus();
      return;
    }
    if (found.tickets) {
      ticketsRef.current?.focus();
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    let result: SubmitResult;
    try {
      result = await submitRaffleEntry({
        fullName,
        phone,
        email,
        chances,
        venmoHandle,
        note,
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }

    if (!result.ok) {
      // These strings were written for a parent to read. Show them as-is.
      setFormError(result.error);
      return;
    }

    setSuccess({
      receiptCode: result.receiptCode,
      displayName: result.displayName,
      amountCents: ticketsToCents(chances),
    });
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
    window.setTimeout(() => setCopied('idle'), 2500);
  }

  function startAnother() {
    setSuccess(null);
    setCopied('idle');
    setFullName('');
    setPhone('');
    setEmail('');
    setTicketsText('1');
    setVenmoHandle('');
    setNote('');
    setErrors({});
    setFormError(null);
  }

  /* ---------------- success ---------------- */

  if (success) {
    return (
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease }}
        ref={successRef}
        tabIndex={-1}
        className="card-electric rounded-2xl p-5 sm:p-7 focus:outline-none"
      >
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gold-500/15 flex items-center justify-center">
            <BoltIcon className="w-7 h-7 text-gold-400" />
          </div>
          <h3 className="text-stadium text-3xl sm:text-4xl text-gradient-gold">You are in</h3>
          <p className="mt-2 text-white/70 text-sm font-body">
            Save this receipt code. It is how you check your entry on this page.
          </p>
        </div>

        {/* Receipt code */}
        <div className="mt-6 rounded-xl border-2 border-dashed border-gold-500/50 bg-navy-900/70 px-3 py-5 text-center">
          <p className="font-accent uppercase tracking-[0.25em] text-[11px] text-white/45">
            Your receipt code
          </p>
          <p className="mt-2 font-mono text-3xl sm:text-4xl font-bold text-gold-400 tracking-[0.2em] break-all">
            {success.receiptCode}
          </p>
          <button
            type="button"
            onClick={() => void copyCode(success.receiptCode)}
            className="mt-4 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 text-xs font-accent uppercase tracking-wider hover:bg-white/10 hover:text-white active:scale-[0.97] transition-all"
          >
            {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Press and hold to copy' : 'Copy code'}
          </button>
          <p aria-live="polite" className="sr-only">
            {copied === 'ok'
              ? 'Receipt code copied to your clipboard.'
              : copied === 'fail'
                ? 'Copying did not work on this device. Press and hold the code to copy it.'
                : ''}
          </p>
        </div>

        {/* Money */}
        <div className="mt-5 rounded-xl border border-gold-500/30 bg-navy-900/50 p-4 text-center">
          <p className="font-accent uppercase tracking-[0.2em] text-[11px] text-white/45">
            If you have not sent it yet
          </p>
          <p className="mt-1 text-stadium text-4xl sm:text-5xl text-gold-400 glow-gold-subtle">
            {formatUsd(success.amountCents)}
          </p>
          <p className="mt-1 text-sm text-white/70 font-body">
            on Venmo to <span className="text-white">{VENMO.displayName}</span>, the account owned by{' '}
            {VENMO.accountOwner}.
          </p>
          <a
            href={VENMO.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lightning mt-4 inline-flex items-center justify-center gap-2 text-sm"
          >
            <BoltIcon className="w-3.5 h-3.5" />
            Open Venmo
          </a>
        </div>

        {/* What happens next */}
        <div className="mt-5 rounded-xl bg-white/5 border border-white/10 p-4 space-y-2">
          <p className="text-sm text-white/75 font-body leading-relaxed">
            Your entry is <span className="text-amber-300 font-semibold">PENDING</span> until Coach{' '}
            {CONTACT_FIRST} matches the Venmo payment by hand, usually within a few hours. When he
            does, he texts you your ticket numbers and they post on the board below.
          </p>
          <p className="text-sm text-white/60 font-body leading-relaxed">
            No automatic email or text goes out, so nothing lands in a spam folder. If you want to
            check before he gets to it, put this code into{' '}
            <a href="#receipt" className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              Check your entry
            </a>{' '}
            any time.
          </p>
          <p className="text-sm text-white/60 font-body leading-relaxed">
            Publicly you will show as{' '}
            <span className="text-gold-400 font-semibold">{success.displayName}</span> and nothing
            else. Questions go to Coach {RAFFLE_CONTACT.name},{' '}
            <a href={`tel:${RAFFLE_CONTACT.phoneRaw}`} className="text-gold-400 hover:text-gold-300 underline underline-offset-2">
              {RAFFLE_CONTACT.phone}
            </a>
            .
          </p>
        </div>

        <button
          type="button"
          onClick={startAnother}
          className="mt-5 w-full py-3 rounded-xl border border-white/10 text-white/60 text-xs font-accent uppercase tracking-wider hover:text-white hover:bg-white/5 transition-colors"
        >
          Enter someone else
        </button>
      </motion.div>
    );
  }

  /* ---------------- closed, and not-yet-known ---------------- */

  /* Order matters. The success panel above outranks the gate, so somebody who
     submitted in the last minute before the deadline keeps their receipt code
     on screen instead of watching it get replaced by a closed sign. */
  if (entriesClosed) return <EntriesClosedCard drawn={draw?.status === 'drawn'} />;
  if (drawLoading) return <FormSkeleton />;

  /* ---------------- form ---------------- */

  return (
    <motion.form
      noValidate
      onSubmit={(e) => void handleSubmit(e)}
      initial={{ y: 24, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease }}
      className="card-electric rounded-2xl p-5 sm:p-7 space-y-5"
    >
      <div>
        <h3 className="text-stadium text-3xl sm:text-4xl text-gradient-gold">Enter the raffle</h3>
        <p className="mt-1.5 text-sm text-white/60 font-body leading-relaxed">
          Send the Venmo first, then fill this out.
        </p>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="raffle-name" className={LABEL_CLASS}>
          Your name <span className="text-red-400">*</span>
        </label>
        <input
          id="raffle-name"
          ref={nameRef}
          type="text"
          autoComplete="name"
          maxLength={MAX_NAME_CHARS}
          value={fullName}
          onChange={(e) => {
            setFullName(e.target.value);
            clearError('fullName');
          }}
          placeholder="First and last name"
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={errors.fullName ? 'raffle-name-error' : 'raffle-name-public'}
          className={FIELD_CLASS}
        />
        <FieldError id="raffle-name-error" message={errors.fullName} />
        <p id="raffle-name-public" className="mt-1.5 text-xs text-white/50 font-body">
          {trimmedName.length > 0 ? (
            <>
              Only <span className="text-gold-400 font-semibold">&ldquo;{derivedDisplayName}&rdquo;</span>{' '}
              will be shown publicly.
            </>
          ) : (
            'The board shows a first name and a masked initial, nothing else.'
          )}
        </p>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="raffle-phone" className={LABEL_CLASS}>
          Phone <span className="text-red-400">*</span>
        </label>
        <input
          id="raffle-phone"
          ref={phoneRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            clearError('phone');
          }}
          placeholder="(555) 555-5555"
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={errors.phone ? 'raffle-phone-error' : 'raffle-phone-help'}
          className={FIELD_CLASS}
        />
        <FieldError id="raffle-phone-error" message={errors.phone} />
        <p id="raffle-phone-help" className="mt-1.5 text-xs text-white/40 font-body">
          Never shown publicly. It is how Coach {CONTACT_FIRST} reaches you if you win.
        </p>
      </div>

      {/* Email */}
      <div>
        <label htmlFor="raffle-email" className={LABEL_CLASS}>
          Email <span className="text-white/25">(optional)</span>
        </label>
        <input
          id="raffle-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={120}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={FIELD_CLASS}
        />
      </div>

      {/* Tickets + amount */}
      <div>
        <label htmlFor="raffle-tickets" className={LABEL_CLASS}>
          How many tickets <span className="text-red-400">*</span>
        </label>

        {/* grid, not flex-wrap: at 375px a wrapping row drops "10" onto a line of its own */}
        <div className="grid grid-cols-5 gap-2">
          {QUICK_PICKS.map((n) => {
            const active = chances === n;
            return (
              <button
                key={n}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTicketsText(String(n));
                  clearError('tickets');
                }}
                className={`py-3 rounded-xl font-accent uppercase tracking-wider text-sm font-bold border transition-all active:scale-[0.97] ${
                  active
                    ? 'bg-gold-500 border-gold-500 text-navy-900'
                    : 'bg-navy-700 border-white/10 text-white/70 hover:border-gold-500/40 hover:text-white'
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>

        <div className="mt-2.5 flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => bumpTickets(-1)}
            aria-label="One less ticket"
            className="w-12 shrink-0 rounded-xl bg-navy-700 border border-white/10 text-white/70 text-xl leading-none hover:border-gold-500/40 hover:text-white active:scale-[0.97] transition-all"
          >
            &minus;
          </button>
          <input
            id="raffle-tickets"
            ref={ticketsRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={ticketsText}
            onChange={(e) => {
              setTicketsText(e.target.value.replace(/\D/g, '').slice(0, 3));
              clearError('tickets');
            }}
            placeholder="1"
            aria-invalid={errors.tickets ? true : undefined}
            aria-describedby={errors.tickets ? 'raffle-tickets-error' : 'raffle-amount'}
            className={`${FIELD_CLASS} text-center text-2xl font-bold font-accent`}
          />
          <button
            type="button"
            onClick={() => bumpTickets(1)}
            aria-label="One more ticket"
            className="w-12 shrink-0 rounded-xl bg-navy-700 border border-white/10 text-white/70 text-xl leading-none hover:border-gold-500/40 hover:text-white active:scale-[0.97] transition-all"
          >
            +
          </button>
        </div>

        <FieldError id="raffle-tickets-error" message={errors.tickets} />

        {/* The number that must not be misread */}
        <div
          id="raffle-amount"
          className="mt-3 rounded-xl border border-gold-500/40 bg-navy-900/60 p-4 text-center"
        >
          <p className="font-accent uppercase tracking-[0.2em] text-[11px] text-white/45">
            Send this much on Venmo
          </p>
          <p
            aria-live="polite"
            className="mt-1 text-stadium text-5xl sm:text-6xl text-gold-400 glow-gold-subtle"
          >
            {formatUsd(amountCents)}
          </p>
          <p className="mt-1 text-sm text-white/60 font-body">
            {chances === 1 ? '1 ticket' : `${Math.max(chances, 0)} tickets`} at{' '}
            {formatUsd(PRICE_PER_TICKET_CENTS)} each, to {VENMO.displayName}
          </p>
          <a
            href={VENMO.codeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lightning-outline mt-4 inline-flex items-center justify-center gap-2 text-sm"
          >
            <BoltIcon className="w-3.5 h-3.5" />
            Open Venmo
          </a>
        </div>
      </div>

      {/* Venmo handle */}
      <div>
        <label htmlFor="raffle-venmo" className={LABEL_CLASS}>
          Venmo handle you sent from <span className="text-gold-500/80">(strongly encouraged)</span>
        </label>
        <input
          id="raffle-venmo"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={60}
          value={venmoHandle}
          onChange={(e) => setVenmoHandle(e.target.value)}
          placeholder="@your-venmo"
          aria-describedby="raffle-venmo-help"
          className={FIELD_CLASS}
        />
        <p id="raffle-venmo-help" className="mt-1.5 text-xs text-white/50 font-body">
          How Coach {CONTACT_FIRST} matches the payment to you. A payment under a nickname takes
          longer without it.
        </p>
      </div>

      {/* Note */}
      <div>
        <label htmlFor="raffle-note" className={LABEL_CLASS}>
          Note for the coach <span className="text-white/25">(optional)</span>
        </label>
        <textarea
          id="raffle-note"
          rows={3}
          maxLength={MAX_NOTE_CHARS}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE_CHARS))}
          placeholder="Anything Coach Aaron should know"
          className={`${FIELD_CLASS} resize-none`}
        />
        <p className="mt-1.5 text-right text-xs text-white/35 font-body">
          {note.length} / {MAX_NOTE_CHARS}
        </p>
      </div>

      {/* Submit failure, verbatim */}
      {formError && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200 font-body leading-relaxed"
        >
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={`w-full py-4 rounded-xl font-accent uppercase tracking-wider text-base font-bold transition-all flex items-center justify-center gap-2 ${
          submitting
            ? 'bg-gold-500/40 text-navy-900/70 cursor-wait'
            : 'bg-gold-500 text-navy-900 hover:bg-gold-400 active:scale-[0.98]'
        }`}
      >
        {submitting ? (
          <>
            <Spinner className="w-5 h-5 animate-spin" />
            Submitting
          </>
        ) : (
          <>
            <BoltIcon className="w-4 h-4" />
            Submit my entry
          </>
        )}
      </button>

      <p className="text-center text-xs text-white/40 font-body">
        Entries stay PENDING until Coach {CONTACT_FIRST} confirms the Venmo payment.
      </p>
    </motion.form>
  );
}
