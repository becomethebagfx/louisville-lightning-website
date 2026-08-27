/* ============================================================
   RAFFLE PAGE
   Every date, price, phone number and URL on this page comes
   from raffleData.ts, and Supabase is reached only through
   useRaffle.ts.

   THE DEADLINE THAT MATTERS HERE IS ENTRIES_CLOSE_AT, NOT
   DRAW_AT. They are 19 hours and 1 minute apart: the database
   stops accepting entries at 11:59pm ET on September 30, and
   the drawing is not until 7:00pm ET on October 1. Anything on
   this page that invites a payment (the countdown, the CTA, the
   Venmo QR and the Open Venmo buttons) has to disappear at the
   CLOSE time, because step 1 of the flow it teaches is "send
   the money first". A page that still says enter on October 1
   takes somebody's $10 to $1000 for an entry the database will
   refuse.

   The draw row outranks the visitor's clock. A phone set to the
   wrong day cannot talk its way back into the entry path.
   ============================================================ */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import LightningBackground from '../components/LightningBackground';
import Footer from '../components/Footer';
import PrizeGallery from '../components/raffle/PrizeGallery';
import RaffleEntryForm from '../components/raffle/RaffleEntryForm';
import ReceiptLookup from '../components/raffle/ReceiptLookup';
import TicketBoard from '../components/raffle/TicketBoard';
import DrawResult from '../components/raffle/DrawResult';
import { useCountdown, useRaffleDraw } from '../lib/useRaffle';
import {
  PRIZE,
  VENMO,
  RAFFLE_CONTACT,
  RAFFLE_RULES,
  PRICE_PER_TICKET_CENTS,
  MAX_TICKETS_PER_ENTRY,
  ENTRIES_CLOSE_AT,
  ENTRIES_CLOSE_LABEL,
  FREEZE_DEADLINE_LABEL,
  DRAW_DATE_LABEL,
  DRAW_TIME_LABEL,
  ticketsToCents,
  formatUsd,
} from '../lib/raffleData';
import { CLUB_NAME } from '../lib/tryoutData';

const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  initial: { y: 40, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: '-80px' },
};

/** Every price on this page is derived, never typed. */
const PRICE = formatUsd(PRICE_PER_TICKET_CENTS);
const THREE_TICKETS = formatUsd(ticketsToCents(3));
const CONTACT_FIRST = RAFFLE_CONTACT.name.split(' ')[0];

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  );
}

/** Two digits so the tiles never resize as the clock ticks. */
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function CountdownTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="card-electric rounded-lg py-3 px-1">
      <div className="text-stadium text-3xl sm:text-4xl md:text-5xl text-white leading-none tabular-nums">
        {pad(value)}
      </div>
      <div className="mt-1 text-gold-500/70 font-accent uppercase tracking-[0.15em] text-[10px] sm:text-xs">
        {label}
      </div>
    </div>
  );
}

function StepCard({
  n,
  title,
  delay,
  children,
}: {
  n: number;
  title: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <motion.li {...fadeUp} transition={{ duration: 0.8, delay, ease }}>
      <div className="card-electric rounded-lg p-6 md:p-7 h-full">
        {/* The number and the title share a row; the BODY sits below at full
            card width. It used to be a second column indented past the badge,
            which meant the QR code and the Open Venmo button centred on that
            column and read as pushed right inside the card. Anything centred
            in here is now centred on the card itself. */}
        <div className="flex items-center gap-4">
          <span className="flex-shrink-0 w-11 h-11 rounded-full bg-gold-500 text-navy-900 text-stadium text-2xl flex items-center justify-center leading-none pt-1">
            {n}
          </span>
          <h3 className="min-w-0 flex-1 text-stadium text-xl md:text-2xl text-white leading-tight">
            {title}
          </h3>
        </div>
        <div className="mt-4 text-white/70 text-sm md:text-base">{children}</div>
      </div>
    </motion.li>
  );
}

/** Where the closed page sends people instead of the entry path. */
function LinkCard({ href, title, children }: { href: string; title: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="card-electric rounded-lg p-5 block h-full group transition-shadow hover:shadow-[0_0_30px_rgba(245,184,0,0.18)]"
    >
      <h3 className="text-stadium text-xl text-white leading-tight transition-colors group-hover:text-gold-400">
        {title}
      </h3>
      <p className="mt-2 text-white/60 text-sm leading-relaxed">{children}</p>
    </a>
  );
}

/* ------------------------------------------------------------
   HOW TO ENTER
   Rendered ONLY while entries are open. Step 1 is a Venmo
   payment, and the QR code plus the Open Venmo buttons live
   inside it, so this whole section is the money-losing surface
   once the database stops accepting entries.
   ------------------------------------------------------------ */
function HowToEnter() {
  return (
    <section className="relative bg-navy-900 py-12 md:py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <motion.div {...fadeUp} transition={{ duration: 0.8, ease }} className="text-center">
          <h2 className="text-stadium text-3xl md:text-5xl">
            <span className="text-white">Two</span>{' '}
            <span className="text-gradient-gold">Steps</span>
          </h2>
          <p className="mt-3 text-white/60">
            Do both. One without the other is not an entry.
          </p>
        </motion.div>

        <ol className="mt-8 space-y-5 list-none p-0">
          <StepCard n={1} delay={0.1} title={`Send ${PRICE} a ticket on Venmo`}>
            <p>
              To <span className="text-gold-500 font-semibold">{VENMO.displayName}</span>.{' '}
              {THREE_TICKETS} is three tickets, and so on up to {MAX_TICKETS_PER_ENTRY}.
            </p>

            <div className="mt-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-shrink-0 rounded-xl bg-white p-3 ring-2 ring-gold-500/50 shadow-[0_0_30px_rgba(245,184,0,0.18)]">
                <img
                  src={VENMO.qrImage}
                  alt={`Venmo QR code for ${VENMO.displayName}`}
                  className="block w-40 h-40 sm:w-44 sm:h-44"
                />
              </div>

              <div className="w-full flex-1 text-center sm:text-left">
                <a
                  href={VENMO.codeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-lightning text-base w-full sm:w-auto inline-flex items-center justify-center gap-2"
                >
                  <BoltIcon className="w-4 h-4" />
                  Open Venmo
                </a>
                <p className="mt-3 text-white/50 text-sm">
                  Scan the code, or tap the button on your phone.
                </p>
              </div>
            </div>
          </StepCard>

          <StepCard n={2} delay={0.2} title="Fill out the form below">
            <p>
              Thirty seconds. It is the only way we can match your Venmo payment to you, and it
              hands you a receipt code. Screenshot the code.
            </p>
            <a
              href="#enter"
              className="btn-lightning-outline text-sm inline-flex items-center gap-2 mt-4"
            >
              Go to the form
            </a>
          </StepCard>
        </ol>

        {/* Step 3 is waiting, not doing. It does not need a card. */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.8, delay: 0.3, ease }}
          className="mt-6 text-center text-white/55 text-sm md:text-base"
        >
          We check it against Venmo by hand, then your numbers post on{' '}
          <a href="#board" className="text-gold-500 underline underline-offset-4 hover:text-gold-400">
            the ticket board
          </a>
          .
        </motion.p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------
   WHAT REPLACES IT
   Same slot, opposite job: stop the payment, then hand people
   the three things they can still do.

   Deliberately does NOT repeat the entry form's closed card.
   That card, a screen below this one, owns the "sent the money
   and never got a receipt code" recovery. This one owns the
   money warning and the navigation, and points at the other
   rather than restating it.
   ------------------------------------------------------------ */
function EntriesClosedNotice({ drawn }: { drawn: boolean }) {
  return (
    <section className="relative bg-navy-900 py-12 md:py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div {...fadeUp} transition={{ duration: 0.8, ease }} className="text-center">
          <h2 className="text-stadium text-3xl md:text-5xl">
            <span className="text-white">Do Not Send</span>{' '}
            <span className="text-gradient-gold">Any More Money</span>
          </h2>
          <p className="mt-3 text-white/60 max-w-xl mx-auto">
            Entries closed {ENTRIES_CLOSE_LABEL}.
          </p>
        </motion.div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.8, delay: 0.1, ease }}
          className="mt-7 rounded-lg border-2 border-gold-500 bg-gold-500/10 p-5 md:p-6 flex items-start gap-3"
        >
          <BoltIcon className="w-5 h-5 mt-0.5 text-gold-500 flex-shrink-0" />
          <p className="text-white text-sm md:text-base leading-relaxed">
            <span className="text-stadium text-lg md:text-xl text-gold-500 tracking-wide">
              Nothing sent now can buy a ticket.
            </span>{' '}
            Anything sent after the deadline gets no ticket number and has to be sent back by
            hand.
          </p>
        </motion.div>

        <motion.p
          {...fadeUp}
          transition={{ duration: 0.8, delay: 0.15, ease }}
          className="mt-5 text-white/55 text-sm md:text-base text-center max-w-xl mx-auto"
        >
          Paid before the deadline but never got a receipt code? The panel below tells you what to
          do.
        </motion.p>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.8, delay: 0.2, ease }}
          className="mt-8 grid gap-4 sm:grid-cols-3"
        >
          <LinkCard href="#board" title="The ticket board">
            Every confirmed entry and the numbers it holds.
          </LinkCard>
          <LinkCard href="#receipt" title="Check your entry">
            Put in your receipt code to see whether your payment is matched and which numbers are
            yours.
          </LinkCard>
          <LinkCard href="#result" title={drawn ? 'The result' : 'The frozen list'}>
            {drawn
              ? `The winning number, the seed it came from and the recording of the drawing.`
              : `The numbered list and its published fingerprint, up before the drawing at ${DRAW_TIME_LABEL}.`}
          </LinkCard>
        </motion.div>
      </div>
    </section>
  );
}

export default function RafflePage() {
  /* THE GATE. Counts down to entries CLOSING, not to the drawing, and the
     draw row can close the page even if the visitor's clock says otherwise.
     Null from useCountdown means the close time has passed. */
  const entriesLeft = useCountdown(ENTRIES_CLOSE_AT);
  const { draw, loading: drawLoading } = useRaffleDraw();
  const dbClosed = draw !== null && draw.status !== 'open';
  const entriesClosed = entriesLeft === null || dbClosed;
  const drawn = draw?.status === 'drawn';

  const smsBody = `Hi Coach ${CONTACT_FIRST}, I have a question about the ${PRIZE.name} raffle.`;

  return (
    <div className="relative pt-16">
      <LightningBackground />
      <main className="relative z-10">
        {/* ---------- 1. HERO ---------- */}
        <section className="relative pt-8 pb-12 md:pt-10 md:pb-16 text-center px-4">
          {/* Fade into the solid sections below */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-navy-900 pointer-events-none" />

          {/* logo-full.png is a 1179x2556 vertical lockup, so it renders about
              2.2x as tall as it is wide. Sized deliberately small here: on
              every other page the logo is the hero, but on this one the price
              is, and a 520px logo pushes it clean off a laptop screen. */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease }}
            className="mb-2"
          >
            <img
              src="/assets/logo-full.png"
              alt="Louisville Lightning"
              className="w-32 md:w-40 mx-auto drop-shadow-[0_0_40px_rgba(245,184,0,0.4)]"
            />
          </motion.div>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="text-gold-500 font-accent uppercase tracking-[0.2em] text-xs md:text-sm"
          >
            {CLUB_NAME} Fundraiser
          </motion.p>

          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25, ease }}
            className="mt-3 text-stadium text-3xl sm:text-5xl md:text-6xl leading-[1.05] text-balance"
          >
            <span className="text-white">Win the</span>{' '}
            <span className="text-gradient-gold glow-gold">{PRIZE.name}</span>
          </motion.h1>

          {/* The price. Loudest thing on the page, by design. */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, delay: 0.4, ease }}
            className="mt-8 flex flex-col items-center"
          >
            <span className="text-stadium text-8xl sm:text-9xl leading-[0.82] text-gradient-gold glow-gold">
              {PRICE}
            </span>
            <span className="mt-2 text-stadium text-3xl sm:text-4xl md:text-5xl text-white tracking-[0.12em] leading-none">
              a ticket
            </span>
          </motion.div>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55, ease }}
            className="mt-5 text-white/70 text-base md:text-lg max-w-md mx-auto"
          >
            One glove. One winner. {DRAW_DATE_LABEL}. Every dollar goes to the team.
          </motion.p>

          {/* The clock is on the CLOSE time. That is the deadline that costs
              somebody money, and it is 19 hours before the drawing. */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65, ease }}
            className="mt-9 max-w-md mx-auto"
          >
            {entriesClosed ? (
              <div className="card-electric rounded-lg py-6 px-5">
                <h2 className="text-stadium text-3xl sm:text-4xl text-gold-500 glow-gold-subtle leading-none">
                  Entries are closed
                </h2>
                <p className="mt-3 text-white/70 text-sm leading-relaxed">
                  {drawn ? (
                    <>
                      The drawing has been made. The winning number, the frozen list it was drawn
                      from and the recording are all further down this page.
                    </>
                  ) : (
                    <>
                      The numbered list gets frozen and its fingerprint published on this page by{' '}
                      {FREEZE_DEADLINE_LABEL}, and then the drawing runs {DRAW_TIME_LABEL}.
                    </>
                  )}
                </p>
                <p className="mt-2 text-white/50 text-sm">
                  Thank you to everybody who bought a ticket.
                </p>
              </div>
            ) : (
              <>
                <p className="text-gold-500/80 font-accent uppercase tracking-[0.2em] text-[11px] sm:text-xs">
                  Entries close in
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
                  <CountdownTile value={entriesLeft.days} label="Days" />
                  <CountdownTile value={entriesLeft.hours} label="Hours" />
                  <CountdownTile value={entriesLeft.minutes} label="Minutes" />
                  <CountdownTile value={entriesLeft.seconds} label="Seconds" />
                </div>
                <p className="mt-3 text-white/50 text-xs sm:text-sm">
                  Entries close {ENTRIES_CLOSE_LABEL}. The drawing is {DRAW_TIME_LABEL}.
                </p>
              </>
            )}
          </motion.div>

          {/* Suppressed while the draw row is still in flight as well as when
              it says closed. A CTA painted for one beat before the page
              closes is long enough for somebody to start a payment. */}
          {!entriesClosed && !drawLoading ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.75, ease }}
              className="mt-8"
            >
              <a href="#enter" className="btn-lightning text-base inline-flex items-center gap-2">
                <BoltIcon className="w-4 h-4" />
                Enter the Raffle
              </a>
            </motion.div>
          ) : null}
        </section>

        {/* ---------- 2. THE PRIZE ---------- */}
        <PrizeGallery />

        {/* ---------- 3. HOW TO ENTER, OR WHY YOU CANNOT ---------- */}
        {entriesClosed ? <EntriesClosedNotice drawn={drawn} /> : <HowToEnter />}

        {/* ---------- 4. ENTRY FORM ----------
            Rendered in BOTH states on purpose. It gates itself, and that is
            what keeps a receipt code from a just-submitted entry on screen
            when the deadline passes while somebody is still reading it. */}
        <section id="enter" className="scroll-mt-20">
          <RaffleEntryForm />
        </section>

        {/* ---------- 5. RECEIPT LOOKUP ---------- */}
        <section id="receipt" className="scroll-mt-20">
          <ReceiptLookup />
        </section>

        {/* ---------- 6. TICKET BOARD ---------- */}
        <section id="board" className="scroll-mt-20">
          <TicketBoard />
        </section>

        {/* ---------- 7. DRAW RESULT ---------- */}
        <section id="result" className="scroll-mt-20">
          <DrawResult />
        </section>

        {/* ---------- 8. RULES ----------
            Collapsed by default. Nine rules is the right amount of rule and
            the wrong amount of wall: open, it pushed the contact card below
            three screens of text nobody reads until something goes wrong.
            Native <details> so it needs no state and works with the page
            search a person uses to find the one line they care about. */}
        <section id="rules" className="relative bg-navy-900 py-10 md:py-14 px-4 scroll-mt-20">
          <div className="max-w-3xl mx-auto">
            <motion.div {...fadeUp} transition={{ duration: 0.8, ease }}>
              <details className="card-electric rounded-lg group">
                <summary className="cursor-pointer list-none p-5 md:p-6 flex items-center justify-between gap-4">
                  <span className="text-stadium text-2xl md:text-3xl text-white group-open:text-gold-500 transition-colors">
                    The fine print
                  </span>
                  <span className="flex-shrink-0 font-accent uppercase tracking-widest text-[11px] text-gold-500/80">
                    <span className="group-open:hidden">Read the rules</span>
                    <span className="hidden group-open:inline">Hide</span>
                  </span>
                </summary>
                <ol className="px-5 md:px-6 pb-6 space-y-3.5 list-none">
                  {RAFFLE_RULES.map((rule, i) => (
                    <li key={i} className="flex items-start gap-3.5">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full border border-gold-500/50 text-gold-500 font-accent font-bold text-xs flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="flex-1 min-w-0 pt-0.5 text-white/70 text-sm leading-relaxed">
                        {rule}
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            </motion.div>
          </div>
        </section>

        {/* ---------- 9. QUESTIONS ---------- */}
        <section id="contact" className="relative bg-navy-900 pb-16 md:pb-20 px-4 scroll-mt-20">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.8, ease }}
            className="max-w-3xl mx-auto"
          >
            <div className="card-electric rounded-lg p-7 md:p-8 text-center">
              <div className="text-gold-500 font-accent uppercase tracking-[0.25em] text-xs">
                Questions
              </div>
              <div className="mt-2 text-stadium text-2xl md:text-3xl text-white leading-tight">
                {RAFFLE_CONTACT.role} {RAFFLE_CONTACT.name}
              </div>
              <p className="mt-3 text-white/60 text-sm md:text-base max-w-md mx-auto">
                Text or call about anything on this page. Better to ask than to guess.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-center">
                <a
                  href={`sms:${RAFFLE_CONTACT.phoneRaw}?body=${encodeURIComponent(smsBody)}`}
                  className="btn-lightning text-sm inline-flex items-center justify-center gap-2"
                >
                  <ChatIcon className="w-4 h-4" />
                  Text {CONTACT_FIRST}
                </a>
                <a
                  href={`tel:${RAFFLE_CONTACT.phoneRaw}`}
                  className="btn-lightning-outline text-sm inline-flex items-center justify-center gap-2"
                >
                  <PhoneIcon className="w-4 h-4" />
                  {RAFFLE_CONTACT.phone}
                </a>
              </div>
            </div>
          </motion.div>
        </section>

        {/* ---------- 10. FOOTER ---------- */}
        <Footer />
      </main>
    </div>
  );
}
