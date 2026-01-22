import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';

export default function VideoSection() {
  const ref = useRef(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <section id="video" className="relative py-24 md:py-32 bg-navy-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8" ref={ref}>
        {/* Section Header */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12"
        >
          <span className="text-gold-500 font-accent uppercase tracking-[0.2em] text-sm">
            Watch Us Play
          </span>
          <h2 className="text-stadium text-4xl md:text-6xl mt-4">
            <span className="text-white">SEE US IN</span>{' '}
            <span className="text-gradient-gold">ACTION</span>
          </h2>
        </motion.div>

        {/* Video Container */}
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative aspect-video rounded-lg overflow-hidden border border-gold-500/20 box-glow-gold"
        >
          {/* Video */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            poster="/assets/logo-transparent.png"
            playsInline
            onEnded={() => setIsPlaying(false)}
          >
            <source src="/assets/promo-video.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>

          {/* Play/Pause Overlay */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 cursor-pointer ${
              isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
            }`}
            onClick={handlePlay}
          >
            {/* Dark overlay */}
            <div className={`absolute inset-0 bg-navy-900/60 transition-opacity ${isPlaying ? 'opacity-0' : 'opacity-100'}`} />

            {/* Play/Pause Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="play-btn relative z-10"
            >
              {isPlaying ? (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </motion.button>
          </div>

          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-gold-500" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-gold-500" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-gold-500" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-gold-500" />
        </motion.div>

        {/* Caption */}
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={isInView ? { y: 0, opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mt-6 text-white/50 text-sm"
        >
          Louisville Lightning 2025 Season Promo
        </motion.p>
      </div>
    </section>
  );
}
