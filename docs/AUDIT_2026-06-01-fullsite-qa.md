# Full-Site Visual QA - 2026-06-01

Eyes-on QA of the live loulightning.com across all pages, desktop (1440x900)
+ mobile (375x812). Method: Playwright captured 18 screenshots + hard data
(broken images, console errors, element positions); a 4-agent workflow
classified findings per page; main loop verified with vision.

## Hard data (all pages)
- Console errors: **0** on every page (1 pre-existing PWA meta deprecation warning only).
- Broken images: **0**. Logos load (logo-transparent 800x800, logo-full 1179x2556).
- Nav correct on every page. No stale "7U" anywhere visible. Em/en dash: source CLEAN.

## Per-page

### Home - issues found + FIXED
- **Tier 2 (FIXED):** hero logo rendered 971px tall (logo-full.png is a tall portrait), pushing the 8U&9U badge, "Tryouts Now Open" banner, and primary "Tryout Info" CTA BELOW the fold on desktop AND mobile. Fix: capped logo `max-h-[40vh] sm:42vh lg:44vh` + tightened hero padding. Verified CTA now above fold: desktop button bottom 883<=900, mobile 795<=812.
- **Tier 3 (FIXED):** About feature body text contrast `/60`->`/70`.
- **Tier 3 (FIXED):** Contact decorative bolts `/30`->`/50`.
- Observed (intentional, not changed): "THE DETAILS" section is airy at the bottom - consistent with the spacious theme, not a defect.

### Tryouts - CLEAN
All copy verified against ground truth: 9U Sun July 20; 8U Sun July 26 & Aug 2; both 4:00 to 6:00 PM; Garvin 502.821.1880; Davis 502.299.1804; Watkins Church, 9800 Westport Road, Louisville KY 40241; motto correct. Layout clean desktop + mobile. Lightning behind header, solid sections below.

### Walk-Up Songs - one DATA item (not code)
Page renders great (header, install banner, speaker setup, player/song cards, play buttons all clean). **Two song titles contain en-dashes** ("Pitbull – Fireball...", "Grinding All My Life – Nips...") - these are song metadata stored in **Supabase**, not source code. Flagged to Brandon; needs a data edit, not a code fix.

### Scout (PIN gate) - CLEAN modal
COACH PIN modal is on-brand and correct (gold lock, 4 inputs, CANCEL). Header appears dim because the modal's dark backdrop overlays the fixed navbar - acceptable for a coach-only gated tool. (Workflow agent's "ROSTER link / hamburger" claims were hallucinations from the dim image; real nav confirmed Home/Tryouts/Songs/Scout via DOM.)

## Status: CLEAN (all fixable tiers fixed; 1 data item flagged to user)
Deployed to loulightning.com (commit adcabe1).
