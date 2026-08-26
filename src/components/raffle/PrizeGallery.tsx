import { motion } from 'framer-motion';
import { PRIZE } from '../../lib/raffleData';

const ease = [0.16, 1, 0.3, 1] as const;

const fadeUp = {
  initial: { y: 40, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: '-80px' },
};

/**
 * The two prize photos plus the spec line underneath.
 *
 * size and retailUsd are widened off the `as const` contract on purpose:
 * both are empty today (Taylor has not read the tag yet) and the line for
 * each must simply not exist until someone fills the value in. Widening
 * keeps the guard a real runtime check rather than a literal-type no-op.
 */
export default function PrizeGallery() {
  const size: string = PRIZE.size;
  const retailUsd: number = PRIZE.retailUsd;

  return (
    <section className="relative bg-navy-900 pt-10 pb-12 md:pt-14 md:pb-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.p
          {...fadeUp}
          transition={{ duration: 0.8, ease }}
          className="text-center text-gold-500 font-accent uppercase tracking-[0.25em] text-xs md:text-sm"
        >
          What you are playing for
        </motion.p>

        <div className="mt-6 grid gap-5 sm:gap-6 sm:grid-cols-2">
          {PRIZE.photos.map((photo, i) => (
            <motion.figure
              key={photo.src}
              initial={{ y: 40, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, delay: 0.12 * i, ease }}
              className="mx-auto w-full max-w-sm sm:max-w-none m-0"
            >
              <img
                src={photo.src}
                alt={photo.alt}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="block w-full aspect-[3/4] object-cover rounded-2xl ring-2 ring-gold-500/60 shadow-[0_0_45px_rgba(245,184,0,0.22)]"
              />
            </motion.figure>
          ))}
        </div>

        <motion.div
          {...fadeUp}
          transition={{ duration: 0.8, delay: 0.1, ease }}
          className="mt-8 text-center"
        >
          <h2 className="text-stadium text-3xl sm:text-4xl md:text-5xl text-white leading-tight text-balance">
            {PRIZE.name}
          </h2>

          <p className="mt-3 text-gold-500 font-accent uppercase tracking-[0.18em] text-sm md:text-base">
            {PRIZE.colorway}
          </p>

          {size ? (
            <p className="mt-2 text-white/70 font-accent uppercase tracking-[0.18em] text-sm md:text-base">
              Size {size}
            </p>
          ) : null}

          {retailUsd > 0 ? (
            <p className="mt-3 text-white/50 text-sm">
              A ${retailUsd} glove, and one of these is going home with somebody.
            </p>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
