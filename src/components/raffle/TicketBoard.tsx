import { motion } from 'framer-motion';
import { formatTicketRange } from '../../lib/raffleData';
import { useRaffleBoard } from '../../lib/useRaffle';

/* ============================================================
   THE PUBLIC LEDGER
   Every confirmed entry, its ticket numbers, and nothing else.
   display_name is the only name that exists on this surface;
   the anon role is not even granted the other columns.

   Polls every 30s so the board fills in live while people are
   sitting on it waiting for their own numbers to appear.
   ============================================================ */

const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  initial: { y: 24, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: '-60px' },
};

/** Placeholder rows drawn before the first fetch lands. */
const SKELETON_ROWS = 6;

/** How often the board re-reads itself, in milliseconds. */
const POLL_MS = 30000;

const LABEL = 'font-accent uppercase tracking-wider text-xs text-white/50';
const ROW =
  'flex items-baseline justify-between gap-3 rounded-md border border-white/10 bg-navy-800/50 px-4 py-3';

function StatNumber({ value, loading }: { value: number; loading: boolean }) {
  if (loading) {
    return <div className="mx-auto h-10 w-16 rounded bg-white/10 animate-pulse" />;
  }
  return (
    <div className="text-stadium text-4xl md:text-5xl text-gold-500 glow-gold-subtle leading-none tabular-nums">
      {value}
    </div>
  );
}

export default function TicketBoard() {
  const { rows, stats, loading } = useRaffleBoard(POLL_MS);

  return (
    <div className="relative bg-navy-900 py-12 md:py-16 px-4">
      <div className="w-full max-w-5xl mx-auto">
        {/* ---- stats strip: ticket counts only. Never the money. ---- */}
        <motion.div {...fadeUp} transition={{ duration: 0.7, ease }}>
          <div className="card-electric rounded-lg">
            <div className="grid grid-cols-2">
              <div className="px-4 py-5 text-center">
                <StatNumber value={stats.total_tickets} loading={loading} />
                <div className={`mt-2 ${LABEL}`}>
                  {stats.total_tickets === 1 ? 'Ticket in the pool' : 'Tickets in the pool'}
                </div>
              </div>
              <div className="px-4 py-5 text-center border-l border-white/10">
                <StatNumber value={stats.verified_entries} loading={loading} />
                <div className={`mt-2 ${LABEL}`}>
                  {stats.verified_entries === 1 ? 'Confirmed entry' : 'Confirmed entries'}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 px-4 py-3 text-center">
              {loading ? (
                <div className="mx-auto h-4 w-56 max-w-full rounded bg-white/10 animate-pulse" />
              ) : stats.pending_entries > 0 ? (
                <p className="text-sm text-white/60">
                  <span className="text-gold-400 font-semibold tabular-nums">
                    {stats.pending_entries}
                  </span>{' '}
                  {stats.pending_entries === 1 ? 'entry' : 'entries'} awaiting payment
                  confirmation
                </p>
              ) : null}
            </div>
          </div>
        </motion.div>

        {/* ---- what you are looking at ---- */}
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.7, delay: 0.1, ease }}
          className="mt-6 text-center text-white/60 text-sm md:text-base max-w-2xl mx-auto"
        >
          Numbers are assigned in the order payments clear, starting at #1.
        </motion.p>

        {/* ---- the ledger ---- */}
        <div className="mt-5" aria-busy={loading}>
          {loading ? (
            <ul className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <li key={i} className={ROW}>
                  <div className="h-6 w-20 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
                </li>
              ))}
            </ul>
          ) : rows.length === 0 ? (
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.7, ease }}
              className="rounded-lg border border-dashed border-gold-500/30 bg-navy-800/40 px-6 py-10 text-center"
            >
              <div className="text-stadium text-2xl md:text-3xl text-gold-500 glow-gold-subtle">
                No confirmed entries yet
              </div>
              <p className="mt-2 text-white/60">Be the first.</p>
            </motion.div>
          ) : (
            <ul className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((r, i) => (
                <motion.li
                  key={r.ticket_start}
                  initial={{ y: 14, opacity: 0 }}
                  whileInView={{ y: 0, opacity: 1 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: Math.min(i * 0.03, 0.45), ease }}
                  className={ROW}
                >
                  <span className="text-stadium text-2xl md:text-3xl text-gold-500 glow-gold-subtle leading-none tabular-nums whitespace-nowrap">
                    {formatTicketRange(r.ticket_start, r.ticket_end)}
                  </span>
                  <span className="min-w-0 truncate text-right text-white/70 text-sm md:text-base">
                    {r.display_name}
                  </span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
