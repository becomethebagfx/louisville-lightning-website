import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

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
            <span className="text-white">READY TO</span>
            <br />
            <span className="text-gradient-gold glow-gold">PLAY?</span>
          </h2>
        </motion.div>

        {/* Description */}
        <motion.p
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 text-white/60 text-lg md:text-xl max-w-xl mx-auto"
        >
          Get in touch with us to learn more about tryouts, tournaments, and joining the Louisville Lightning family.
        </motion.p>

        {/* Email Button */}
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <a
            href="mailto:brandonhayman.b@gmail.com?subject=Louisville Lightning 7U - Inquiry"
            className="btn-lightning text-lg inline-flex items-center gap-3"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Contact Us
          </a>
        </motion.div>

        {/* Email Display */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          <a
            href="mailto:brandonhayman.b@gmail.com"
            className="text-gold-500 hover:text-gold-400 transition-colors font-accent tracking-wide"
          >
            brandonhayman.b@gmail.com
          </a>
        </motion.div>

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
              className="w-6 h-6 text-gold-500/30"
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
