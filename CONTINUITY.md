# CONTINUITY LEDGER

## Goal
Louisville Lightning tryout Google Form (owned by loulightningclub@gmail.com,
responses auto-flow to a Google Sheet) + form link on loulightning.com +
website names head coaches (Danny Knapp = Lightning Blue, Taylor Davis =
Lightning Yellow). Text Brandon when done. Full plan:
~/.claude/plans/louisville-lightning-tryout-form.md

## Constraints / Assumptions
- Team Gmail: loulightningclub@gmail.com / LouLightning2026! (also in CLAUDE.md)
- Taylor's Yellow-requirements file + private parent comms NEVER go on the
  public site (standing boundary). Context/memory only.
- Keep navy/gold theme, /walkup, /scout, schedule, roster intact.
- Form fields verbatim from Taylor: player name, birthday, bats L/R, throws
  L/R, primary position, secondary position, preferred team (Yellow-Davis /
  Blue-Knapp / either), tryout date (July 19 / July 26 / both),
  parent/guardian name(s), injury disclaimer + practices/tournaments
  commitment disclaimer.
- ASSUMPTION (UNCONFIRMED): Yellow + Blue are the two 8U teams; Knapp is the
  second-team coach memory hinted at. Verify from forwarded email.
- Gmail MCP token expired 2026-07-01; use browser automation for Gmail.

## Key Decisions
- Add parent phone + email as required form fields (signup sheet unusable
  without contact info): falls under Taylor's "anything pertinent I forgot".
- Form/Sheet created via browser automation as loulightningclub@gmail.com
  (no Google Forms API setup needed; account owns everything).

## State
### Done
- Creds saved to CLAUDE.md Infrastructure Reference (2026-07-01)
- Plan written: ~/.claude/plans/louisville-lightning-tryout-form.md
- Repo + memory context loaded (tryoutData.ts is single source of truth;
  TryoutsPage renders from it)
### Now
- Phase 0: retrieve forwarded Taylor emails (Chrome -> mail.google.com)
### Next
- Phase 1: create Google Form + linked Sheet as loulightningclub, verify with
  test submission
- Phase 2: website update (form CTA + coach names)
- Phase 3: deploy + live verify; Phase 4: wiring audit + memories + SMS

## Open Questions
- Does Blue/Yellow replace 8U/9U on /tryouts? (default: two 8U teams)
- Where do "teams information sheet + schedule" live? (default: link existing
  schedule from form description)

## Working Set
- Files: src/lib/tryoutData.ts, src/pages/TryoutsPage.tsx, src/App.tsx
- IDs: Render service louisville-lightning; repo becomethebagfx/louisville-lightning-website
- Commands: npm run build; npm run lint; Twilio SMS snippet in CLAUDE.md
