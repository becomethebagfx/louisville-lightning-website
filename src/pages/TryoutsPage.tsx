import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import LightningBackground from '../components/LightningBackground';
import Footer from '../components/Footer';
import {
  TRYOUT_GROUPS,
  TRYOUT_LOCATION,
  TRYOUT_LOOKING_FOR,
  TRYOUT_FORM_URL,
  LIGHTNING_TEAMS,
} from '../lib/tryoutData';

const fadeUp = {
  initial: { y: 40, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: '-80px' },
};

const ease = [0.16, 1, 0.3, 1] as const;

const PARENT_HANDOUT_URL = '/lightning-tryout-schedule.pdf';

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13 0L0 14h9l-2 10 13-14h-9l2-10z" />
    </svg>
  );
}

export default function TryoutsPage() {
  return (
    <div className="relative pt-16">
      <LightningBackground />
      <main className="relative z-10">
        {/* Header */}
        <section className="relative pt-20 pb-10 md:pt-28 md:pb-14 text-center px-4">
          {/* Fade into the solid sections below */}
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
              className="w-56 md:w-72 mx-auto drop-shadow-[0_0_40px_rgba(245,184,0,0.4)]"
            />
          </motion.div>

          <motion.h1
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
            className="text-stadium text-5xl md:text-7xl lg:text-8xl"
          >
            <span className="text-white">BASEBALL</span>{' '}
            <span className="text-gradient-gold glow-gold">TRYOUTS</span>
          </motion.h1>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35, ease }}
            className="mt-4 text-gold-500 font-accent uppercase tracking-[0.25em] text-sm md:text-base"
          >
            Come be a part of Louisville Lightning
          </motion.p>

          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.45, ease }}
            className="mt-5 text-white/70 text-lg max-w-2xl mx-auto font-body"
          >
            {TRYOUT_LOOKING_FOR}
          </motion.p>

          {TRYOUT_FORM_URL && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.55, ease }}
              className="mt-8"
            >
              <Link
                to="/register"
                className="btn-lightning text-base inline-flex items-center gap-2"
              >
                <BoltIcon className="w-4 h-4" />
                Register for Tryouts
              </Link>
              <p className="mt-3 text-white/50 text-sm">
                Tryout Information Sheet &amp; Waiver · takes a few minutes
              </p>
            </motion.div>
          )}
        </section>

        {/* Age-group tryout cards */}
        <section className="relative bg-navy-900 pt-8 pb-8 px-4">
          <div
            className={`max-w-5xl mx-auto grid gap-6 lg:gap-8 ${
              TRYOUT_GROUPS.length > 1 ? 'md:grid-cols-2' : 'md:max-w-xl'
            }`}
          >
            {TRYOUT_GROUPS.map((g, i) => (
              <motion.div
                key={g.ageGroup}
                {...fadeUp}
                transition={{ duration: 0.8, delay: 0.1 * (i + 1), ease }}
              >
                <div className="card-electric rounded-lg p-7 md:p-8 h-full">
                  <div className="flex items-baseline gap-3">
                    <span className="text-stadium text-5xl md:text-6xl text-gold-500 glow-gold-subtle leading-none">
                      {g.ageGroup}
                    </span>
                    <span className="text-white/60 font-accent uppercase tracking-wider text-sm">
                      Tryout{g.sessions.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Sessions */}
                  <div className="mt-6 space-y-3">
                    {g.sessions.map((s, j) => (
                      <div
                        key={j}
                        className="flex items-center justify-between gap-3 border-l-2 border-gold-500/60 pl-4 py-1"
                      >
                        <div className="text-white">
                          <div className="font-accent uppercase tracking-wide text-lg">
                            {s.weekday ? `${s.weekday}, ${s.date}` : s.date}
                          </div>
                        </div>
                        {g.time !== 'TBD' && (
                          <span className="text-gold-500 font-accent font-bold whitespace-nowrap">
                            {g.time}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Eligibility */}
                  <div className="mt-6 pt-5 border-t border-white/10 space-y-1">
                    <div className="flex items-center gap-2 text-white/80">
                      <BoltIcon className="w-4 h-4 text-gold-500/70 flex-shrink-0" />
                      <span className="text-sm">{g.ageRule}</span>
                    </div>
                    <p className="text-white/50 text-sm pl-6">{g.bornCutoff}</p>
                  </div>

                  {/* Contact */}
                  <div className="mt-6 pt-5 border-t border-white/10">
                    <div className="text-gold-500/80 font-accent uppercase tracking-wider text-xs">
                      {g.contactRole} · {g.contactName}
                    </div>
                    <div className="mt-3 flex flex-col sm:flex-row gap-3">
                      <a
                        href={`sms:${g.contactPhoneRaw}?body=${encodeURIComponent(`Hi! I'm interested in Louisville Lightning ${g.ageGroup} tryouts.`)}`}
                        className="btn-lightning text-sm inline-flex items-center justify-center gap-2 flex-1"
                      >
                        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Text {g.contactName.split(' ')[0]}
                      </a>
                      <a
                        href={`tel:${g.contactPhoneRaw}`}
                        className="btn-lightning-outline text-sm inline-flex items-center justify-center gap-2 flex-1"
                      >
                        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {g.contactPhonePretty}
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Tryout schedule / parent information sheet */}
        <section className="relative bg-navy-900 pt-6 pb-8 px-4">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.8, ease }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-stadium text-3xl md:text-4xl">
              <span className="text-white">TRYOUT</span>{' '}
              <span className="text-gradient-gold">SCHEDULE</span>
            </h2>
            <p className="mt-3 text-white/60 max-w-2xl mx-auto">
              See how the two hour tryout runs, station by station, so you know what
              to expect. Print it or save it to your phone for the day.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={PARENT_HANDOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-lightning text-sm inline-flex items-center justify-center gap-2"
              >
                <BoltIcon className="w-4 h-4" />
                View Schedule
              </a>
              <a
                href={PARENT_HANDOUT_URL}
                download="Louisville Lightning Tryout Schedule.pdf"
                className="btn-lightning-outline text-sm inline-flex items-center justify-center gap-2"
              >
                <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PDF
              </a>
            </div>

            {/* Embedded preview (best on desktop; mobile users use the buttons above) */}
            <div className="mt-8 card-electric rounded-lg p-1 sm:p-2 overflow-hidden">
              <object
                data={`${PARENT_HANDOUT_URL}#view=FitH`}
                type="application/pdf"
                aria-label="Louisville Lightning tryout schedule"
                className="w-full rounded-md bg-white h-[560px] sm:h-[720px] md:h-[900px]"
              >
                <div className="p-8 text-center bg-white rounded-md">
                  <p className="text-navy-800 font-body">
                    Your browser can&apos;t preview the PDF here.
                  </p>
                  <a
                    href={PARENT_HANDOUT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-navy-700 underline underline-offset-2 font-semibold"
                  >
                    Open the tryout schedule
                  </a>
                </div>
              </object>
            </div>
          </motion.div>
        </section>

        {/* Two teams */}
        <section className="relative bg-navy-900 pt-8 pb-4 px-4">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.8, ease }}
            className="max-w-5xl mx-auto text-center"
          >
            <h2 className="text-stadium text-3xl md:text-4xl">
              <span className="text-white">TWO</span>{' '}
              <span className="text-gradient-gold">8U TEAMS</span>
            </h2>
            <p className="mt-3 text-white/60 max-w-2xl mx-auto">
              Our 8U program fields two teams: Lightning Yellow and Lightning
              Blue. Tell us your preferred team when you register, or mark
              either.
            </p>
          </motion.div>
          <div className="mt-8 max-w-3xl mx-auto grid sm:grid-cols-2 gap-6">
            {LIGHTNING_TEAMS.map((t, i) => (
              <motion.div
                key={t.name}
                {...fadeUp}
                transition={{ duration: 0.8, delay: 0.1 * (i + 1), ease }}
              >
                <div className="card-electric rounded-lg p-6 text-center h-full">
                  <div
                    className={`text-stadium text-2xl md:text-3xl leading-none ${
                      t.colorWord === 'Yellow' ? 'text-gold-500 glow-gold-subtle' : 'text-sky-400'
                    }`}
                  >
                    {t.name.toUpperCase()}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="text-gold-500/80 font-accent uppercase tracking-wider text-xs">
                      Head Coach
                    </div>
                    <div className="mt-1 text-white text-lg font-accent uppercase tracking-wide">
                      {t.headCoach}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Location */}
        <section className="relative bg-navy-900 py-12 px-4">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.8, ease }}
            className="max-w-3xl mx-auto"
          >
            <div className="card-electric rounded-lg p-7 md:p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
              <div className="flex-shrink-0 w-16 h-16 bg-gold-500/10 rounded-lg flex items-center justify-center text-gold-500">
                <svg aria-hidden="true" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-gold-500 font-accent uppercase tracking-wider text-xs">
                  Tryout Location
                </div>
                <div className="text-stadium text-2xl md:text-3xl text-white mt-1">
                  {TRYOUT_LOCATION.name}
                </div>
                <div className="text-white/70 mt-1">
                  {TRYOUT_LOCATION.address}
                  <br />
                  {TRYOUT_LOCATION.cityState}
                </div>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(TRYOUT_LOCATION.mapsQuery)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-lightning-outline text-sm whitespace-nowrap"
              >
                Get Directions
              </a>
            </div>
          </motion.div>
        </section>

        {/* Motto */}
        <section className="relative bg-navy-900 pb-20 px-4">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.8, ease }}
            className="text-center"
          >
            <div className="flex justify-center gap-4 mb-5">
              {[...Array(3)].map((_, i) => (
                <BoltIcon key={i} className="w-5 h-5 text-gold-500/40" />
              ))}
            </div>
            <p className="text-stadium text-2xl md:text-3xl">
              <span className="text-white">Built on</span>{' '}
              <span className="text-gradient-gold">character.</span>{' '}
              <span className="text-white">Focused on</span>{' '}
              <span className="text-gradient-gold">excellence.</span>
            </p>
            {TRYOUT_FORM_URL && (
              <Link
                to="/register"
                className="btn-lightning text-sm inline-flex items-center gap-2 mt-8"
              >
                <BoltIcon className="w-4 h-4" />
                Register for Tryouts
              </Link>
            )}
          </motion.div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
