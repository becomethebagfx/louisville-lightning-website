import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { TRYOUT_GROUPS, TRYOUT_MOTTO, TRYOUTS_COMPLETE } from '../lib/tryoutData';

export default function Contact() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section id="contact" className="relative py-24 md:py-32 bg-navy-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center" ref={ref}>
        {/* Section Header */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="text-stadium text-5xl md:text-7xl lg:text-8xl">
            <span className="text-white">GET IN</span>
            <br />
            <span className="text-gradient-gold glow-gold">TOUCH</span>
          </h2>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-white/60 text-lg md:text-xl max-w-xl mx-auto"
        >
          {TRYOUTS_COMPLETE
            ? 'Questions about the team, the season, or anything Louisville Lightning? Reach out anytime.'
            : 'Questions about tryouts, the team, or anything Louisville Lightning? Reach out anytime.'}
        </motion.p>

        {/* Contact Cards */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className={`mt-10 grid gap-6 mx-auto ${
            TRYOUT_GROUPS.length > 1 ? 'sm:grid-cols-2 max-w-3xl' : 'max-w-md'
          }`}
        >
          {TRYOUT_GROUPS.map((g) => (
            <div key={g.ageGroup} className="card-electric rounded-lg p-6">
              <div className="text-gold-500 font-accent uppercase tracking-wider text-sm">
                {g.contactRole}
              </div>
              <div className="text-stadium text-2xl text-white mt-1">{g.contactName}</div>
              <div className="mt-4 flex flex-col gap-3">
                <a
                  href={`sms:${g.contactPhoneRaw}?body=${encodeURIComponent(
                    TRYOUTS_COMPLETE
                      ? `Hi! I have a question about Louisville Lightning ${g.ageGroup}.`
                      : `Hi! I'm interested in Louisville Lightning ${g.ageGroup} tryouts.`
                  )}`}
                  className="btn-lightning text-sm inline-flex items-center justify-center gap-2"
                >
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Text {g.contactName.split(' ')[0]}
                </a>
                <a
                  href={`tel:${g.contactPhoneRaw}`}
                  className="btn-lightning-outline text-sm inline-flex items-center justify-center gap-2"
                >
                  <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {g.contactPhonePretty}
                </a>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Instagram */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          <a
            href="https://www.instagram.com/p/DVXJq9cic6y/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-gold-500/70 hover:text-gold-500 transition-colors font-accent uppercase tracking-wider text-sm"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Follow us on Instagram
          </a>
        </motion.div>

        {/* Coach Info */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 text-white/40 text-sm"
        >
          {TRYOUT_MOTTO}
        </motion.p>

        {/* Decorative lightning bolts */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16 flex justify-center gap-8"
        >
          {[...Array(3)].map((_, i) => (
            <svg
              key={i}
              className="w-6 h-6 text-gold-500/50"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
            </svg>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
