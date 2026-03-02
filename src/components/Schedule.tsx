import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

const tournaments = [
  { date: 'Mar 28-29', label: 'Tournament 1' },
  { date: 'Apr 25-26', label: 'Tournament 2' },
  { date: 'May 16-17', label: 'Tournament 3' },
  { date: 'Jun 6-7', label: 'Tournament 4' },
  { date: 'Jun 13-14', label: 'Tournament 5' },
];

const coaches = [
  'Taylor Davis',
  'Aaron Quesenberry',
  'Aaron Schecter',
  'Shawn Kittle',
  'Brandon Hayman',
];

export default function Schedule() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="schedule" className="relative py-24 md:py-32 bg-navy-900">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        {/* Section Header */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-16"
        >
          <span className="text-gold-500 font-accent uppercase tracking-[0.2em] text-sm">
            2026 Season
          </span>
          <h2 className="text-stadium text-4xl md:text-6xl mt-4">
            <span className="text-white">THE</span>{' '}
            <span className="text-gradient-gold">DETAILS</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
          {/* Left Column - Schedule */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Tournaments */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-gold-500 font-accent uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Tournament Schedule
              </h3>
              <div className="space-y-3">
                {tournaments.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-4 text-white/80"
                  >
                    <span className="text-gold-500 font-accent font-bold w-24 text-right">{t.date}</span>
                    <span className="text-white/50">—</span>
                    <span className="w-28">{t.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-white/50 text-sm text-center">
                3-game guarantee per tournament. All tournaments local (within 1 hour).
              </p>
            </div>

            {/* League */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-gold-500 font-accent uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Wednesday Night League
              </h3>
              <p className="text-white/80 text-center">
                April 15th through end of May
              </p>
            </div>

          </motion.div>

          {/* Right Column - Team Info */}
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={isInView ? { y: 0, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Coaches */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-gold-500 font-accent uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Coaching Staff
              </h3>
              <div className="space-y-2">
                {coaches.map((coach, i) => (
                  <div key={i} className="text-white/80 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 text-gold-500/60" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
                    </svg>
                    {coach}
                  </div>
                ))}
              </div>
            </div>

            {/* Team Size */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-gold-500 font-accent uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Team Size
              </h3>
              <p className="text-white/80 text-center">
                <span className="text-gold-500 font-bold text-2xl">11</span> players on the roster
              </p>
              <p className="text-white/50 text-sm mt-1 text-center">
                Every player gets opportunities at multiple positions
              </p>
            </div>

          </motion.div>
        </div>
      </div>

      {/* Decorative bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
    </section>
  );
}
