import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  RAFFLE_CONTACT,
  SEED_SOURCE_LABEL,
  type RaffleBoardRow,
  type RaffleDraw,
} from '../../lib/raffleData';
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

/* ------------------------------------------------------------
   THE RECIPE BEHIND THE FINGERPRINT

   The panel below tells people they can prove the list for
   themselves. That is only true if the thing that was hashed is
   published, so it is, exactly.

   These mirror raffle_freeze in
   supabase/migrations/20260825b_raffle_hardening.sql. If the
   preimage in that function ever changes, change it here in the
   same commit, or this page starts handing people a recipe that
   does not reproduce the fingerprint printed beside it.
   ------------------------------------------------------------ */

const PREIMAGE_VERSION = 'lightning-raffle/v1';

/** The five parts, in order, one per line. */
const PREIMAGE_TEMPLATE = [
  PREIMAGE_VERSION,
  '<draw id>',
  '<ticket count>',
  '<seed source>',
  '<one line per confirmed entry>',
].join('\n');

const ROW_TEMPLATE = 'ticket_start|ticket_end|display_name';
const ROW_EXAMPLE = '12|14|Sarah M.';
const HASH_CMD_UNIX = 'shasum -a 256 list.txt';
const HASH_CMD_WINDOWS = 'certutil -hashfile list.txt SHA256';

/**
 * Rebuilds the exact bytes raffle_freeze hashed, from the public board.
 * Every value comes off the draw row or the board, never a guess: a
 * reconstruction that quietly substituted a fallback would hash to
 * something else and look like the commitment had failed.
 */
function buildPreimage(draw: RaffleDraw, rows: readonly RaffleBoardRow[]): string {
  return [
    PREIMAGE_VERSION,
    draw.id,
    String(draw.frozen_ticket_count ?? ''),
    // The function coalesces a missing source to an empty line. Mirror that
    // rather than filling in the label, which would not be what was hashed.
    draw.seed_source ?? '',
    rows.map((r) => `${r.ticket_start}|${r.ticket_end}|${r.display_name}`).join('\n'),
  ].join('\n');
}

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

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div>
      <div className={DT}>
        Step {n}. {title}
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </div>
  );
}

/**
 * Anything a person has to copy character for character goes in one of these.
 * whitespace-pre with its own scrollbar, never break-all: a wrapped command is
 * a command somebody retypes wrong, and this whole panel is about exactness.
 */
function CodeBox({
  label,
  muted = false,
  children,
}: {
  label?: string;
  muted?: boolean;
  children: string;
}) {
  return (
    <div>
      {label && <div className={`${DT} mb-1`}>{label}</div>}
      <pre
        className={`whitespace-pre overflow-x-auto overscroll-x-contain ${
          muted ? 'text-white/70' : 'text-gold-300/90 select-all'
        } ${MONO}`}
      >
        {children}
      </pre>
    </div>
  );
}

/**
 * The finished block, rebuilt from the board as it stands right now. Mounted
 * only once the reader opens the recipe, so the 95 percent who never open it
 * never pay for the extra board read.
 */
function PreimageBlock({ draw }: { draw: RaffleDraw }) {
  const { rows, loading, error } = useRaffleBoard();

  if (loading) {
    return <div className="h-24 rounded bg-white/5 animate-pulse" aria-hidden="true" />;
  }

  /* Never render a half-built block. An empty or failed read would hash to
     something that is not the fingerprint, which reads as the commitment
     failing when the only thing that failed was a fetch. */
  if (error || rows.length === 0) {
    return (
      <p className="text-white/50 text-sm leading-relaxed">
        The board did not load, so the block cannot be rebuilt here. Reload the
        page and open this again, or assemble it by hand from the numbered list
        above using steps 1 to 3.
      </p>
    );
  }

  return (
    <>
      <pre
        className={`max-h-72 overflow-auto overscroll-contain whitespace-pre select-all text-gold-300/90 ${MONO}`}
      >
        {buildPreimage(draw, rows)}
      </pre>
      <p className="text-white/50 text-sm leading-relaxed">
        Select all of it, paste it into a plain text file, and save it with no
        blank line at the end.
      </p>
    </>
  );
}

/**
 * A fingerprint nobody can reproduce is decoration. This publishes the exact
 * preimage so the handful of people who actually check are able to, and stays
 * collapsed so it does not shout at everyone who never will.
 */
function VerifyRecipe({ draw }: { draw: RaffleDraw }) {
  const [open, setOpen] = useState(false);
  const count = frozenTicketCount(draw);

  return (
    <details
      className="mt-5 rounded-lg border border-white/10 bg-navy-900/50"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex items-center gap-2 min-h-11 px-4 py-3 cursor-pointer select-none list-none text-gold-400 hover:text-gold-300 transition-colors [&::-webkit-details-marker]:hidden">
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          fill="currentColor"
          className={`w-3 h-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : 'rotate-0'}`}
        >
          <path d="M4 2l5 4-5 4z" />
        </svg>
        <span className="font-accent uppercase tracking-wider text-xs">
          Check this fingerprint yourself
        </span>
      </summary>

      <div className="px-4 pb-5 space-y-5">
        <p className="text-white/60 text-sm leading-relaxed">
          Nothing below is a description of the process. It is the process. The
          fingerprint above is the sha256 of one exact block of text, and this is
          how that block is built. Anything in a box is exact, so a line too long
          for your screen scrolls sideways inside its box rather than wrapping.
        </p>

        <Step n={1} title="The text that gets hashed">
          <CodeBox muted>{PREIMAGE_TEMPLATE}</CodeBox>
          <p className="text-white/50 text-sm leading-relaxed">
            Five parts, in that order, joined by a single newline each. Line
            feeds, not carriage returns. The text is UTF-8, and there is no
            newline after the last entry.
          </p>
        </Step>

        <Step n={2} title="The values for this draw">
          <CodeBox label="Draw id">{draw.id}</CodeBox>
          <CodeBox label="Ticket count">{count === null ? NOT_PUBLISHED : String(count)}</CodeBox>
          {draw.seed_source ? (
            <CodeBox label="Seed source">{draw.seed_source}</CodeBox>
          ) : (
            <div>
              <div className={`${DT} mb-1`}>Seed source</div>
              <p className="text-white/50 text-sm leading-relaxed">
                No source was recorded on this draw, so that line is empty.
              </p>
            </div>
          )}
          <p className="text-white/50 text-sm leading-relaxed">
            The ticket count is the total number of tickets in the pool, the same
            number printed as Tickets locked in above. It is also the divisor in
            the winning number, which is why it is inside the fingerprint.
          </p>
        </Step>

        <Step n={3} title="One line per confirmed entry">
          <CodeBox muted>{ROW_TEMPLATE}</CodeBox>
          <p className="text-white/50 text-sm leading-relaxed">
            One line for every confirmed entry on the board, sorted by first
            ticket number, lowest first. An entry holding one ticket repeats the
            same number on both sides, so three tickets held by Sarah M. look
            like this:
          </p>
          <CodeBox>{ROW_EXAMPLE}</CodeBox>
        </Step>

        {count !== null && (
          <Step n={4} title="The finished block">
            {/* Gated on `open`, not just on the details element being closed:
                a collapsed <details> still mounts its children, so without this
                every visitor pays for a board read they never look at. */}
            {open ? (
              <PreimageBlock draw={draw} />
            ) : (
              <div className="h-24 rounded bg-white/5" aria-hidden="true" />
            )}
          </Step>
        )}

        <Step n={count === null ? 4 : 5} title="Hash it">
          <CodeBox label="Mac or Linux">{HASH_CMD_UNIX}</CodeBox>
          <CodeBox label="Windows">{HASH_CMD_WINDOWS}</CodeBox>
          <p className="text-white/50 text-sm leading-relaxed">
            The 64 characters it prints have to match the fingerprint at the top
            of this panel, character for character. Change one letter of one name,
            move one ticket, add or drop one entry, and they will not.
          </p>
        </Step>
      </div>
    </details>
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

      {/* The recipe only means anything next to a real fingerprint. */}
      {draw.frozen_list_sha256 && <VerifyRecipe draw={draw} />}
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
