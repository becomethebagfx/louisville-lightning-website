import { motion } from 'framer-motion';

export default function Hero() {
  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Content */}
      <div className="relative z-10 text-center px-4 py-20">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <img
            src="/assets/logo-transparent.png"
            alt="Louisville Lightning"
            className="w-48 h-48 md:w-64 md:h-64 mx-auto drop-shadow-[0_0_30px_rgba(245,184,0,0.5)]"
          />
        </motion.div>

        {/* Team Name */}
        <motion.h1
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-stadium text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight"
        >
          <span className="text-white">LOUISVILLE</span>
          <br />
          <span className="text-gradient-gold glow-gold">LIGHTNING</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          <span className="inline-block px-6 py-2 border-2 border-gold-500 text-gold-500 text-xl md:text-2xl tracking-[0.3em] font-accent uppercase">
            7U Travel Baseball
          </span>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-lg md:text-xl text-white/70 max-w-xl mx-auto font-body"
        >
          Elite youth baseball in Louisville, Kentucky. Building champions on and off the field.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <button onClick={scrollToContact} className="btn-lightning text-lg">
            Join The Team
          </button>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            className="w-6 h-10 border-2 border-gold-500/50 rounded-full flex items-start justify-center p-2"
          >
            <motion.div className="w-1.5 h-1.5 bg-gold-500 rounded-full" />
          </motion.div>
        </motion.div>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-navy-900/50 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-navy-900 to-transparent pointer-events-none" />
    </section>
  );
}
