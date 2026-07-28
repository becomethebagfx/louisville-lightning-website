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
}

// ------------------------------------------------------------
// SEASON STATE
// Flip TRYOUTS_COMPLETE back to false (and restore TRYOUT_FORM_URL)
// when the next tryout cycle opens. Every surface reads this flag:
// hero banner, navbar, footer, schedule block, /tryouts, /register.
// ------------------------------------------------------------
export const SEASON_YEAR = '2026';
export const TRYOUTS_COMPLETE = true;

export const TRYOUT_GROUPS: TryoutGroup[] = [
  {
    ageGroup: '8U',
    sessions: [
      { weekday: 'Sunday', date: 'July 19' },
      { weekday: 'Sunday', date: 'July 26' },
    ],
    time: '4:00 to 6:00 PM',
    ageRule: 'Players cannot turn 9 before May 1',
    bornCutoff: 'Born on or after May 1, 2017',
    contactName: 'Taylor Davis',
    contactRole: '8U Contact',
    contactPhonePretty: '502.299.1804',
    contactPhoneRaw: '5022991804',
  },
];

// Google Form: "Louisville Lightning Tryout Information Sheet and Waiver".
// Responses flow to the "Louisville Lightning Tryout Signups 2026" Google
// Sheet on loulightningclub@gmail.com. Embedded on /register; set to '' to
// hide every registration CTA and the page content.
// 2026 tryouts are complete, so registration is closed everywhere. The live
// form URL is kept here (commented) so next season is a one-line restore.
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
// 2026 ROSTERS
// Confirmed by Coach Taylor after the July 26 tryout. Spellings follow the
// parent-submitted signup form (Schoenbaechler, Eicher); first names use the
// nickname each family goes by.
// ------------------------------------------------------------
export const ROSTERS: Record<string, string[]> = {
  'Lightning Yellow': [
    'Micah Davis',
    'Colt Quesenberry',
    'Kashden Deacon',
    'Kash Kittel',
    'Grayson Abramson',
    'Grant Churchman',
    'Mason Schechter',
    'Elijah Hayman',
    'Eli Brown',
    'Isaiah Carroll',
    'Reid Morrison',
  ],
  'Lightning Blue': [
    'Rhodes Schoenbaechler',
    'Davey Knapp',
    'Gus Denson',
    'Beau Kerins',
    'Ryan Zeller',
    'Paxton Eicher',
    'Nolan Shumaker',
    'Jack Lesser',
    'Victor Henry',
    'Landry Burba',
    'Anderson West',
    'Crew Thieneman',
  ],
};

// Shareable announcement graphic (same art Coach Taylor posts to Facebook).
export const ROSTER_GRAPHIC_URL = '/lightning-2026-rosters.png';

export const TRYOUT_LOCATION = {
  name: 'Watkins Church',
  address: '9800 Westport Road',
  cityState: 'Louisville, KY 40241',
  mapsQuery: 'Watkins Church, 9800 Westport Road, Louisville, KY 40241',
};

export const TRYOUT_LOOKING_FOR =
  'We are looking for determined, coachable, and hard-working players to join our family.';

export const TRYOUT_MOTTO = 'Built on character. Focused on excellence.';
