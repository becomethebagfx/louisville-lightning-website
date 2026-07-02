import { motion } from 'framer-motion';
import LightningBackground from '../components/LightningBackground';
import Footer from '../components/Footer';
import { TRYOUT_FORM_URL, LIGHTNING_TEAMS } from '../lib/tryoutData';

const ease = [0.16, 1, 0.3, 1] as const;

export default function RegisterPage() {
  return (
    <div className="relative pt-16">
      <LightningBackground />
      <main className="relative z-10">
        <section className="relative pt-16 pb-8 md:pt-24 md:pb-10 text-center px-4">
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-navy-900 pointer-events-none" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease }}
            className="mb-6"
          >
            <img
              src="/assets/logo-full.png"
              alt="Louisville Lightning"
              className="w-44 md:w-56 mx-auto drop-shadow-[0_0_40px_rgba(245,184,0,0.4)]"
            />
          </motion.div>

          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.15, ease }}
            className="text-stadium text-4xl md:text-6xl lg:text-7xl"
          >
            <span className="text-white">TRYOUT</span>{' '}
            <span className="text-gradient-gold glow-gold">REGISTRATION</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3, ease }}
            className="mt-4 text-white/70 text-lg max-w-2xl mx-auto font-body"
          >
            Complete the information sheet and waiver below. One form per
            player. You will get an email copy when you submit.
          </motion.p>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease }}
            className="mt-3 text-gold-500 font-accent uppercase tracking-[0.2em] text-xs md:text-sm"
          >
            {LIGHTNING_TEAMS.map((t) => `${t.name} · Head Coach ${t.headCoach}`).join('  |  ')}
          </motion.p>

        </section>

        <section className="relative bg-navy-900 pb-8 px-2 sm:px-4">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.45, ease }}
            className="max-w-3xl mx-auto"
          >
            {TRYOUT_FORM_URL ? (
              <div className="card-electric rounded-lg p-1 sm:p-2 overflow-hidden">
                {/* Measured natural form heights: 4221px @320w, 3966px @360w,
                    3880px @375w, 3311px @740w, +~200px validation-error
                    growth. Undersizing clips the Submit button into a nested
                    scroll on touch. */}
                <iframe
                  src={`${TRYOUT_FORM_URL}?embedded=true`}
                  title="Louisville Lightning Tryout Information Sheet and Waiver"
                  className="w-full rounded-md bg-white border-0 h-[4500px] sm:h-[4100px] md:h-[3700px]"
                >
                  Loading form...
                </iframe>
              </div>
            ) : (
              <p className="text-center text-white/60">
                Registration opens soon. Check back shortly.
              </p>
            )}
            {TRYOUT_FORM_URL && (
              <p className="mt-4 text-center text-white/50 text-sm">
                Trouble with the form?{' '}
                <a
                  href={TRYOUT_FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold-500 underline underline-offset-2 hover:text-gold-400"
                >
                  Open it in a new tab
                </a>
                .
              </p>
            )}
          </motion.div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
