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
export const TRYOUT_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSdyTg5jwOh_UlYRFllwELdF7VL5TuOo_gEUiY3De5SEb-Sfxw/viewform';

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

export const TRYOUT_LOCATION = {
  name: 'Watkins Church',
  address: '9800 Westport Road',
  cityState: 'Louisville, KY 40241',
  mapsQuery: 'Watkins Church, 9800 Westport Road, Louisville, KY 40241',
};

export const TRYOUT_LOOKING_FOR =
  'We are looking for determined, coachable, and hard-working players to join our family.';

export const TRYOUT_MOTTO = 'Built on character. Focused on excellence.';
