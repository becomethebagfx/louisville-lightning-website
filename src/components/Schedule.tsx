import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { TRYOUT_GROUPS, TRYOUT_LOCATION, TRYOUT_FORM_URL } from '../lib/tryoutData';

const coaches: { name: string; role?: string }[] = [
  { name: 'Taylor Davis', role: 'Head Coach · Lightning Yellow' },
  { name: 'Danny Knapp', role: 'Head Coach · Lightning Blue' },
  { name: 'Aaron Quesenberry' },
  { name: 'Aaron Schecter' },
  { name: 'Shawn Kittle' },
  { name: 'Brandon Hayman' },
  { name: 'Josh Deacon' },
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
            Now Recruiting · 8U &amp; 9U
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
            {/* Tryouts */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-gold-500 font-accent uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Tryout Dates
              </h3>
              <div className="space-y-3">
                {TRYOUT_GROUPS.map((g) => (
                  <div
                    key={g.ageGroup}
                    className="flex items-center justify-center gap-4 text-white/80"
                  >
                    <span className="text-gold-500 font-accent font-bold w-12 text-right">{g.ageGroup}</span>
                    <span className="text-white/30">|</span>
                    <span className="w-48 text-left">
                      {g.sessions.map((s) => (s.weekday ? `${s.weekday}, ${s.date}` : s.date)).join(' & ')}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-white/50 text-sm text-center">
                8U tryouts run 4:00 to 6:00 PM. 9U date &amp; time to be announced.
              </p>
            </div>

            {/* Location */}
            <div className="mb-10">
              <h3 className="text-xl font-bold text-gold-500 font-accent uppercase tracking-wide mb-4 flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Location
              </h3>
              <p className="text-white/80 text-center">
                {TRYOUT_LOCATION.name}
                <br />
                <span className="text-white/50 text-sm">
                  {TRYOUT_LOCATION.address}, {TRYOUT_LOCATION.cityState}
                </span>
              </p>
            </div>

            <div className="text-center flex flex-col sm:flex-row items-center justify-center gap-3">
              {TRYOUT_FORM_URL && (
                <Link
                  to="/register"
                  className="btn-lightning text-sm inline-flex items-center gap-2"
                >
                  Register for Tryouts
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
                  </svg>
                </Link>
              )}
              <Link
                to="/tryouts"
                className={`${TRYOUT_FORM_URL ? 'btn-lightning-outline' : 'btn-lightning'} text-sm inline-flex items-center gap-2`}
              >
                Full Tryout Info
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
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
                  <div key={i} className="text-white/80 flex flex-col items-center">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-gold-500/60" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
                      </svg>
                      {coach.name}
                    </div>
                    {coach.role && (
                      <div className="text-gold-500/70 font-accent uppercase tracking-wider text-xs">
                        {coach.role}
                      </div>
                    )}
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
