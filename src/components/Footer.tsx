import { motion } from 'framer-motion';

export default function Footer() {
  return (
    <footer className="relative py-12 bg-navy-900 border-t border-gold-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo and name */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="flex items-center gap-4"
          >
            <img
              src="/assets/logo-transparent.png"
              alt="Louisville Lightning"
              className="w-12 h-12"
            />
            <div>
              <div className="text-stadium text-lg text-white">
                LOUISVILLE <span className="text-gold-500">LIGHTNING</span>
              </div>
              <div className="text-xs text-white/40 font-accent uppercase tracking-wider">
                7U Travel Baseball
              </div>
            </div>
          </motion.div>

          {/* Navigation */}
          <motion.nav
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            className="flex items-center gap-8"
          >
            {['About', 'Video', 'Tryouts', 'Schedule', 'Contact'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-white/50 hover:text-gold-500 transition-colors font-accent uppercase tracking-wider text-sm"
              >
                {item}
              </a>
            ))}
          </motion.nav>

          {/* Social/Location */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="flex items-center gap-2 text-white/40 text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Louisville, KY</span>
          </motion.div>
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          viewport={{ once: true }}
          className="mt-10 pt-6 border-t border-white/5 text-center"
        >
          <p className="text-white/30 text-sm">
            © {new Date().getFullYear()} Louisville Lightning. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
