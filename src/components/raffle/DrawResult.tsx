import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { RAFFLE_CONTACT, SEED_SOURCE_LABEL, type RaffleDraw } from '../../lib/raffleData';
import { useRaffleBoard, useRaffleDraw } from '../../lib/useRaffle';

/* ============================================================
   THE COMMITMENT AND THE RESULT
   Renders nothing at all while the raffle is still open. Once
   the list is frozen it publishes the fingerprint; once the
   draw has run it publishes the winning number.

   The winning number is READ off the draw row. It is never
   computed here. The only thing this file derives is which
   published ticket block the number falls inside, so the board
   and this panel cannot disagree about who holds it.
   ============================================================ */

const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  initial: { y: 24, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: '-60px' },
};

const EYEBROW = 'font-accent uppercase tracking-wider text-xs text-gold-500/80';
const DT = 'font-accent uppercase tracking-wider text-xs text-white/40';
const MONO = 'font-mono text-[11px] sm:text-xs rounded border border-white/10 bg-navy-900 p-3';
const NOT_PUBLISHED = 'Not published yet';

/** The contract now carries frozen_ticket_count, so read it straight. */
function frozenTicketCount(draw: RaffleDraw): number | null {
  return typeof draw.frozen_ticket_count === 'number' ? draw.frozen_ticket_count : null;
}

/** ISO instant to something a person reads, in their own time zone. */
function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className={DT}>{label}</dt>
      <dd className="mt-1 text-white/85 text-sm md:text-base">{children}</dd>
    </div>
  );
}

/**
 * The published fingerprint. Shown from the moment the list is frozen and kept
 * on screen after the draw, because the hash is what makes the result checkable.
 */
function Commitment({ draw }: { draw: RaffleDraw }) {
  const count = frozenTicketCount(draw);
  const when = formatWhen(draw.frozen_at);

  return (
    <div className="mt-6 rounded-lg border border-white/10 bg-navy-900/60 p-5 md:p-6 text-left">
      <div className={EYEBROW}>The locked list</div>
      <p className="mt-3 text-white/60 text-sm leading-relaxed">
        The string below is a sha256 fingerprint of the numbered list, taken at
        the moment it was locked. Changing a single number or name, or adding one
        entry after the fact, produces a completely different string. Save this
        and you can prove for yourself that the list you see now is the list that
        was drawn from.
      </p>
      <div className={`mt-4 text-gold-300 select-all break-all ${MONO}`}>
        {draw.frozen_list_sha256 ?? NOT_PUBLISHED}
      </div>
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Tickets locked in">
          <span className="tabular-nums">{count ?? NOT_PUBLISHED}</span>
        </Field>
        <Field label="Locked at">{when ?? NOT_PUBLISHED}</Field>
      </dl>
    </div>
  );
}

/** Entries closed, list published, number not drawn yet. */
function FrozenPanel({ draw }: { draw: RaffleDraw }) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.8, ease }}
      className="card-electric rounded-lg p-6 md:p-8 text-center"
    >
      <div className={EYEBROW}>Entries are closed</div>
      <h3 className="mt-2 text-stadium text-3xl md:text-4xl">
        <span className="text-white">The list is</span>{' '}
        <span className="text-gradient-gold">frozen</span>
      </h3>
      <p className="mt-3 text-white/70 text-sm md:text-base max-w-xl mx-auto">
        Every confirmed entry is locked in. Nothing can be added, removed, or
        renumbered from here.
      </p>

      <Commitment draw={draw} />

      <div className="mt-6 rounded-lg border border-gold-500/20 bg-gold-500/5 p-5 md:p-6 text-left">
        <div className={EYEBROW}>Where the winning number will come from</div>
        <p className="mt-2 text-white text-sm md:text-base">
          {/* From the committed row when it exists: the constant is only a
              fallback for a draw row that has not been seeded yet. */}
          {draw.seed_source ?? SEED_SOURCE_LABEL}
        </p>
        <p className="mt-2 text-white/50 text-sm leading-relaxed">
          Published here before that number exists, so nobody can claim the pick
          was steered. Nobody involved with the team has any say in it.
        </p>
      </div>
    </motion.div>
  );
}

/**
 * Resolves the winning ticket to the display name that already sits on the
 * public board. Renders nothing if the number is not inside a published block.
 */
function WinnerName({ winningTicket }: { winningTicket: number }) {
  const { rows, loading, error } = useRaffleBoard();
  if (loading) return null;

  /* A giant number with nothing beside it reads as the team declining to say
     who won. Distinguish "could not load" from "genuinely unmatched". */
  if (error) {
    return (
      <div className="mt-4 text-white/60 font-body text-base">
        Reloading the board to show the winner...
      </div>
    );
  }

  const holder = rows.find(
    (r) => winningTicket >= r.ticket_start && winningTicket <= r.ticket_end,
  );

  if (!holder) {
    return (
      <div className="mt-4 text-white/60 font-body text-base max-w-md mx-auto">
        This number does not fall inside any published block. Coach{' '}
        {RAFFLE_CONTACT.name} is reviewing it before anything is awarded.
      </div>
    );
  }

  return (
    <div className="mt-4 text-stadium text-3xl md:text-4xl text-white">
      {holder.display_name}
    </div>
  );
}

/** The draw has run. */
function DrawnPanel({ draw, winningTicket }: { draw: RaffleDraw; winningTicket: number }) {
  const count = frozenTicketCount(draw);
  const countLabel = count === null ? 'the frozen ticket count' : String(count);
  const drawnWhen = formatWhen(draw.drawn_at);

  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.8, ease }}
      className="card-electric rounded-lg p-6 md:p-8 text-center"
    >
      <div className={EYEBROW}>Winning ticket</div>

      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.9, ease }}
        className="mt-2 text-stadium text-7xl md:text-8xl text-gold-500 glow-gold leading-none tabular-nums"
      >
        #{winningTicket}
      </motion.div>

      <WinnerName winningTicket={winningTicket} />

      {drawnWhen && <div className="mt-3 text-white/50 text-sm">Drawn {drawnWhen}</div>}

      {/* the arithmetic, spelled out so anyone can redo it by hand */}
      <div className="mt-6 rounded-lg border border-white/10 bg-navy-900/60 p-5 md:p-6 text-left">
        <div className={EYEBROW}>Check the math yourself</div>
        <dl className="mt-3 space-y-4">
          <Field label="Public seed source">{draw.seed_source ?? SEED_SOURCE_LABEL}</Field>
          <Field label="Seed value">
            <span className="font-mono text-gold-300 break-all">
              {draw.seed_value ?? NOT_PUBLISHED}
            </span>
          </Field>
        </dl>
        <p className={`mt-4 text-white/80 break-words leading-relaxed ${MONO}`}>
          #{winningTicket} = 1 + ( first 12 hex digits of sha256(seed value), read as
          a number, mod {countLabel} )
        </p>
      </div>

      <Commitment draw={draw} />

      {draw.draw_video_url && (
        <div className="mt-6">
          <a
            href={draw.draw_video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lightning-outline text-sm inline-flex items-center justify-center gap-2"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Watch the drawing
          </a>
        </div>
      )}
      {!draw.draw_video_url && (
        /* RAFFLE_RULES promises every entrant that the drawing is recorded and
           posted here. Silence where the video should be is the second thing
           an aggrieved parent asks about, right after the hash. */
        <p className="mt-6 text-white/50 font-body text-sm">
          The recording of the drawing is being uploaded and will appear here.
        </p>
      )}
    </motion.div>
  );
}

export default function DrawResult() {
  const { draw, loading } = useRaffleDraw();

  // Nothing to publish while the raffle is still taking entries.
  if (loading || !draw || draw.status === 'open') return null;

  const winningTicket = draw.winning_ticket;

  return (
    <div className="relative bg-navy-900 py-12 md:py-16 px-4">
      <div className="w-full max-w-3xl mx-auto">
        {draw.status === 'drawn' && winningTicket !== null ? (
          <DrawnPanel draw={draw} winningTicket={winningTicket} />
        ) : (
          <FrozenPanel draw={draw} />
        )}
      </div>
    </div>
  );
}
