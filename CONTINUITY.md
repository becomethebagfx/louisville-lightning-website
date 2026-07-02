# CONTINUITY LEDGER

## Goal
Louisville Lightning tryout Google Form (owned by loulightningclub@gmail.com,
responses auto-flow to a Google Sheet) + branded /register page embedding it
on loulightning.com + head coaches named (Danny Knapp = Lightning Blue,
Taylor Davis = Lightning Yellow). Text Brandon when done. Full plan:
~/.claude/plans/louisville-lightning-tryout-form.md

## Constraints / Assumptions
- Team Gmail: loulightningclub@gmail.com (creds in CLAUDE.md).
- PRIVATE (never on site): Taylor's Yellow letter contents - cost/dues,
  tournament date lists, practice weekdays, Beau Schoenbaechler (Blue
  co-coach, unpublished pending Brandon OK).
- Keep navy/gold theme, /walkup, /scout, schedule, roster intact.
- Yellow and Blue schedules DIFFER; form + site keep schedule copy generic.

## Key Decisions
- Form built via Playwright UI automation as loulightningclub (no API/OAuth).
- Email confirmation = Forms "Collect email (responder input)" + "Send copy:
  Always" (replaced my manual parent-email question).
- Registration embedded at /register inside branded page (Brandon asked for
  a page, not a bare link); iframe 3800px + fallback new-tab link.
- Intake close after July 26: cron reminder on do-droplet texts Brandon
  Jul 27 09:00 ET to toggle "Accepting responses" off. Apps Script auto-close
  offered as optional upgrade (needs his OAuth click).

## State
### Done
- Form live: https://docs.google.com/forms/d/e/1FAIpQLSdyTg5jwOh_UlYRFllwELdF7VL5TuOo_gEUiY3De5SEb-Sfxw/viewform
  (14 fields incl. required injury "NOT responsible" waiver + commitment
  checkbox; navy/gold banner theme; reCAPTCHA; email copies on).
- Sheet linked + E2E verified (test row in, then deleted; orphan email
  column removed): "Louisville Lightning Tryout Signups 2026".
- Site: /register page, CTAs on /tryouts + home, nav/footer links, coach
  roles on home. Commit b159914 pushed; LIVE verified cache-busted.
- Screenshots in screenshots/AFTER/. Build + lint + em-dash sweep clean.
- Memories saved: louisville-lightning-tryout-form,
  louisville-lightning-yellow-private-info, google-forms-playwright-build-recipe.
- Droplet cron ll-close-reminder installed (0 13 27 7 *, self-removing).
### Done (audit)
- Wiring audit COMPLETE: round 1 (3 agents) -> 3 Tier 2 + 11 Tier 3, all
  fixed; round 2 -> 1 Tier 3 (Hero "Now Open" vs 9U TBD), fixed; round 3
  scoped -> zero. Artifact docs/AUDIT_2026-07-01.md. Commit afb07f1
  deployed + verified live (9U notice, coach line, responsive iframe).
- Final SMS sent to Brandon.
### Now
- Phase closed. Awaiting Brandon on open questions.
### Next
- If approved: publish Beau Schoenbaechler (Blue co-coach); Apps Script
  auto-close after Jul 26 (needs his OAuth click); confirm age cutoffs.

## Open Questions
- Publish Beau Schoenbaechler as Blue co-coach on the site? (awaiting Brandon)
- Optional Apps Script auto-close of the form after Jul 26 (needs Brandon's
  one-time OAuth Allow in the browser).

## Working Set
- Files: src/lib/tryoutData.ts, src/pages/RegisterPage.tsx,
  src/pages/TryoutsPage.tsx, src/components/Schedule.tsx, Navbar.tsx,
  Footer.tsx, src/App.tsx
- IDs: form edit 1Jbxp8HftSugaFLcJ86Phv5g1DPPtYeaoIsBFfAuQrSI; sheet
  18QW4H78ySEXiARI8j0SQTrjGMzQRWImkeXxSRJUT65I; Render service
  louisville-lightning; commit b159914
- Commands: npm run build; npx vite preview --port 4517; Twilio SMS snippet
  in CLAUDE.md
