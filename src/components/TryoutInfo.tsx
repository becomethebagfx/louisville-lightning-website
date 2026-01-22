import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

export default function TryoutInfo() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="tryouts" className="relative py-24 md:py-32 bg-navy-800 overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 stripe-pattern opacity-50" />

      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center" ref={ref}>
        {/* Lightning bolt decoration */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={isInView ? { scale: 1, opacity: 1 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <svg
            className="w-16 h-16 mx-auto text-gold-500 drop-shadow-[0_0_20px_rgba(245,184,0,0.5)]"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
          </svg>
        </motion.div>

        {/* Section Header */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-gold-500 font-accent uppercase tracking-[0.2em] text-sm">
            Join Our Team
          </span>
          <h2 className="text-stadium text-4xl md:text-6xl mt-4 text-white">
            TRYOUT <span className="text-gradient-gold">DATE</span>
          </h2>
        </motion.div>

        {/* Date Display */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <div className="inline-block border-4 border-gold-500 p-8 md:p-12 box-glow-gold">
            <div className="text-stadium text-6xl md:text-8xl lg:text-9xl text-gold-500 glow-gold leading-none">
              JAN 31
            </div>
            <div className="text-stadium text-2xl md:text-3xl text-white mt-2">
              2026
            </div>
          </div>
        </motion.div>

        {/* Location */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <div className="flex items-center justify-center gap-2 text-white/70">
            <svg className="w-5 h-5 text-gold-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-lg font-accent uppercase tracking-wider">
              Louisville, Kentucky
            </span>
          </div>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-white/60 max-w-xl mx-auto text-lg"
        >
          Open tryouts for players born in 2018 or later. All skill levels welcome.
          Come show us what you've got!
        </motion.p>

        {/* CTA */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <button onClick={scrollToContact} className="btn-lightning text-lg">
            Register for Tryouts
          </button>
        </motion.div>
      </div>

      {/* Decorative bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
    </section>
  );
}
