// ============================================================
// LOUISVILLE LIGHTNING - TRYOUT INFO
// Single source of truth for tryout dates, location, contacts.
// Edit here and every surface (banner, page, schedule) updates.
// ============================================================

export interface TryoutGroup {
  ageGroup: string; // '8U'
  sessions: { weekday: string; date: string }[];
  time: string;
  // How the coaches phrase the cutoff, verbatim:
  ageRule: string;
  // Derived born-on-or-after cutoff (consistent with the 7U convention):
  bornCutoff: string;
  contactName: string;
  contactRole: string;
  contactPhonePretty: string; // for display
  contactPhoneRaw: string; // for tel:/sms: links
  // Whether THIS age group has finished its tryouts. Season state is per
  // group, not global: 8U rosters are set while 7U is still recruiting.
  complete: boolean;
  // Shown when a group takes RSVPs by text instead of a form.
  rsvpNote?: string;
}

// ------------------------------------------------------------
// SEASON STATE
// SEASON_YEAR is display copy and contains a slash, so anything that becomes a
// filename must use SEASON_SLUG instead.
// ------------------------------------------------------------
export const SEASON_YEAR = '2026 / 2027';
export const SEASON_SLUG = '2026-2027';
export const CLUB_NAME = 'Louisville Lightning Baseball Club';

// Open groups come first so the page leads with what people can still act on.
export const TRYOUT_GROUPS: TryoutGroup[] = [
  {
    ageGroup: '7U',
    sessions: [
      { weekday: 'Sunday', date: 'August 9' },
      { weekday: 'Sunday', date: 'August 16' },
    ],
    time: '12:00 to 2:00 PM',
    ageRule: 'Players cannot turn 8 before May 1, 2027',
    bornCutoff: 'Born on or after May 1, 2019',
    contactName: 'Geoff Novak',
    contactRole: '7U Contact',
    contactPhonePretty: '502.938.5388',
    contactPhoneRaw: '5029385388',
    complete: false,
    rsvpNote: 'Please RSVP by messaging Geoff.',
  },
  {
    ageGroup: '8U',
    sessions: [
      { weekday: 'Sunday', date: 'July 19' },
      { weekday: 'Sunday', date: 'July 26' },
    ],
    time: '4:00 to 6:00 PM',
    ageRule: 'Players cannot turn 9 before May 1, 2027',
    bornCutoff: 'Born on or after May 1, 2018',
    contactName: 'Taylor Davis',
    contactRole: '8U Contact',
    contactPhonePretty: '502.299.1804',
    contactPhoneRaw: '5022991804',
    complete: true,
  },
];

// Derived, so adding or closing a group updates every surface on its own.
export const OPEN_TRYOUT_GROUPS = TRYOUT_GROUPS.filter((g) => !g.complete);
export const TRYOUTS_COMPLETE = OPEN_TRYOUT_GROUPS.length === 0;
// e.g. "7U" today, "7U + 9U" if two groups open at once.
export const OPEN_AGE_LABEL = OPEN_TRYOUT_GROUPS.map((g) => g.ageGroup).join(' + ');
// True once any group has finished, so the roster section survives a new
// age group reopening tryouts.
export const HAS_ROSTERS = TRYOUT_GROUPS.some((g) => g.complete);

// Google Form: "Louisville Lightning Tryout Information Sheet and Waiver".
// Responses flow to the "Louisville Lightning Tryout Signups 2026" Google
// Sheet on loulightningclub@gmail.com. Embedded on /register; set to '' to
// hide every registration CTA and the page content.
// No form is in use right now: 7U takes RSVPs by text to its contact, and 8U
// is already rostered. Restoring the URL below re-enables every registration
// CTA and the embedded form on /register.
// 'https://docs.google.com/forms/d/e/1FAIpQLSdyTg5jwOh_UlYRFllwELdF7VL5TuOo_gEUiY3De5SEb-Sfxw/viewform'
export const TRYOUT_FORM_URL = '';

export interface LightningTeam {
  name: string; // 'Lightning Yellow' | 'Lightning Blue'
  colorWord: string; // 'Yellow' | 'Blue'
  headCoach: string;
}

// 8U fields two teams; players indicate a preferred team when registering.
export const LIGHTNING_TEAMS: LightningTeam[] = [
  { name: 'Lightning Yellow', colorWord: 'Yellow', headCoach: 'Taylor Davis' },
  { name: 'Lightning Blue', colorWord: 'Blue', headCoach: 'Danny Knapp' },
];

// ------------------------------------------------------------
// 2026 / 2027 ROSTERS
// DELIBERATE: player names are NOT stored here and are NOT published on this
// site. These are minors and this repository is public. Only team sizes live
// here. The roster graphic with names is shared by the coaches directly
// (Facebook, team email); it is not served from this site.
// ------------------------------------------------------------
export const ROSTER_SIZES: Record<string, number> = {
  'Lightning Yellow': 11,
  'Lightning Blue': 12,
};

export const TRYOUT_LOCATION = {
  name: 'Watkins Church',
  address: '9800 Westport Road',
  cityState: 'Louisville, KY 40241',
  mapsQuery: 'Watkins Church, 9800 Westport Road, Louisville, KY 40241',
};

export const TRYOUT_LOOKING_FOR =
  'We are looking for determined, coachable, and hard-working players to join our family.';

export const TRYOUT_MOTTO = 'Built on character. Focused on excellence.';
