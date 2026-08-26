import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import LightningBackground from '../components/LightningBackground';
import Footer from '../components/Footer';
import PrizeGallery from '../components/raffle/PrizeGallery';
import RaffleEntryForm from '../components/raffle/RaffleEntryForm';
import ReceiptLookup from '../components/raffle/ReceiptLookup';
import TicketBoard from '../components/raffle/TicketBoard';
import DrawResult from '../components/raffle/DrawResult';
import { useCountdown } from '../lib/useRaffle';
import {
  PRIZE,
  VENMO,
  RAFFLE_CONTACT,
  RAFFLE_RULES,
  PRICE_PER_CHANCE_CENTS,
  MAX_CHANCES_PER_ENTRY,
  DRAW_AT,
  DRAW_DATE_LABEL,
  DRAW_TIME_LABEL,
  ENTRIES_CLOSE_LABEL,
  chancesToCents,
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
const PRICE = formatUsd(PRICE_PER_CHANCE_CENTS);
const THREE_CHANCES = formatUsd(chancesToCents(3));
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
        <div className="flex items-start gap-4">
          <span className="flex-shrink-0 w-11 h-11 rounded-full bg-gold-500 text-navy-900 text-stadium text-2xl flex items-center justify-center leading-none pt-1">
            {n}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-stadium text-xl md:text-2xl text-white leading-tight">{title}</h3>
            <div className="mt-3 text-white/70 text-sm md:text-base">{children}</div>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export default function RafflePage() {
  // Counts down to the drawing itself. Null means the moment has passed,
  // which is the one case where a row of zeros would be a lie.
  const left = useCountdown(DRAW_AT);

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
              a chance
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

          {/* Countdown to the drawing */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.65, ease }}
            className="mt-9 max-w-md mx-auto"
          >
            <p className="text-gold-500/80 font-accent uppercase tracking-[0.2em] text-[11px] sm:text-xs">
              Drawing {DRAW_TIME_LABEL}
            </p>

            {left ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
                <CountdownTile value={left.days} label="Days" />
                <CountdownTile value={left.hours} label="Hours" />
                <CountdownTile value={left.minutes} label="Minutes" />
                <CountdownTile value={left.seconds} label="Seconds" />
              </div>
            ) : (
              <div className="mt-3 card-electric rounded-lg py-6 px-4">
                <div className="text-stadium text-3xl sm:text-4xl text-gold-500 glow-gold-subtle leading-none">
                  Entries Closed
                </div>
                <p className="mt-2 text-white/50 text-sm">
                  Thank you to everybody who bought a chance.
                </p>
              </div>
            )}

            <p className="mt-3 text-white/50 text-xs sm:text-sm">
              Entries close {ENTRIES_CLOSE_LABEL}
            </p>
          </motion.div>

          {left ? (
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

        {/* ---------- 3. HOW TO ENTER ---------- */}
        <section className="relative bg-navy-900 py-12 md:py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div {...fadeUp} transition={{ duration: 0.8, ease }} className="text-center">
              <h2 className="text-stadium text-3xl md:text-5xl">
                <span className="text-white">How to</span>{' '}
                <span className="text-gradient-gold">Enter</span>
              </h2>
              <p className="mt-3 text-white/60 max-w-xl mx-auto">
                Two things have to happen, and both of them are on you. Send the money, then fill
                out the form.
              </p>
            </motion.div>

            {/* The one thing people get wrong. Say it before the steps, not after. */}
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="mt-7 rounded-lg border-2 border-gold-500 bg-gold-500/10 p-5 md:p-6 flex items-start gap-3"
            >
              <BoltIcon className="w-5 h-5 mt-0.5 text-gold-500 flex-shrink-0" />
              <p className="text-white text-sm md:text-base leading-relaxed">
                <span className="text-stadium text-lg md:text-xl text-gold-500 tracking-wide">
                  Both steps are required.
                </span>{' '}
                A Venmo payment with no entry form does not get a ticket number, and an entry form
                with no Venmo payment does not get one either. Do step 1, then do step 2.
              </p>
            </motion.div>

            <ol className="mt-8 space-y-5 list-none p-0">
              <StepCard n={1} delay={0.1} title={`Send ${PRICE} per chance on Venmo`}>
                <p>
                  Send it to{' '}
                  <span className="text-gold-500 font-semibold">{VENMO.displayName}</span>. Any
                  multiple counts: {PRICE} is one chance, {THREE_CHANCES} is three. Up to{' '}
                  {MAX_CHANCES_PER_ENTRY} chances on a single entry.
                </p>
                <p className="mt-2 text-white/50 text-sm">
                  The account belongs to {VENMO.accountOwner}. Check that name before you send
                  anything.
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
                      Point your phone camera at the code, or tap the button and Venmo opens on the
                      right account.
                    </p>
                  </div>
                </div>
              </StepCard>

              <StepCard n={2} delay={0.2} title="Fill out the entry form below">
                <p>
                  The form is the only way Coach {CONTACT_FIRST} can match a Venmo payment to a
                  person. It takes about thirty seconds and it hands you a receipt code, so
                  screenshot that code when it shows up.
                </p>
                <a
                  href="#enter"
                  className="btn-lightning-outline text-sm inline-flex items-center gap-2 mt-4"
                >
                  Jump to the form
                </a>
              </StepCard>

              <StepCard n={3} delay={0.3} title="Watch for your ticket numbers on the board">
                <p>
                  Your entry starts as pending. Once the payment is matched it flips to verified and
                  your ticket numbers post on the board on this page. Only a first name and a last
                  initial ever appear there.
                </p>
                <a
                  href="#board"
                  className="btn-lightning-outline text-sm inline-flex items-center gap-2 mt-4"
                >
                  See the board
                </a>
              </StepCard>
            </ol>
          </div>
        </section>

        {/* ---------- 4. ENTRY FORM ---------- */}
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

        {/* ---------- 8. RULES ---------- */}
        <section id="rules" className="relative bg-navy-900 py-12 md:py-16 px-4 scroll-mt-20">
          <div className="max-w-3xl mx-auto">
            <motion.h2
              {...fadeUp}
              transition={{ duration: 0.8, ease }}
              className="text-stadium text-3xl md:text-5xl text-center"
            >
              <span className="text-white">The</span>{' '}
              <span className="text-gradient-gold">Rules</span>
            </motion.h2>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.8, delay: 0.1, ease }}
              className="mt-8 card-electric rounded-lg p-6 md:p-8"
            >
              <ol className="space-y-5 list-none p-0">
                {RAFFLE_RULES.map((rule, i) => (
                  <li key={i} className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full border border-gold-500/50 text-gold-500 font-accent font-bold text-sm flex items-center justify-center">
                      {i + 1}
                    </span>
                    <p className="flex-1 min-w-0 pt-1 text-white/70 text-sm md:text-base leading-relaxed">
                      {rule}
                    </p>
                  </li>
                ))}
              </ol>
            </motion.div>
          </div>
        </section>

        {/* ---------- 9. QUESTIONS ---------- */}
        <section className="relative bg-navy-900 pb-16 md:pb-20 px-4">
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
