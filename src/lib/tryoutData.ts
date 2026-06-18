// ============================================================
// LOUISVILLE LIGHTNING - TRYOUT INFO
// Single source of truth for tryout dates, location, contacts.
// Edit here and every surface (banner, page, schedule) updates.
// ============================================================

export interface TryoutGroup {
  ageGroup: string; // '8U' | '9U'
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
    ageGroup: '9U',
    sessions: [{ weekday: 'Sunday', date: 'July 20' }],
    time: '4:00 to 6:00 PM',
    ageRule: 'Players cannot turn 10 before May 1',
    bornCutoff: 'Born on or after May 1, 2016',
    contactName: 'Steven Garvin',
    contactRole: '9U Contact',
    contactPhonePretty: '502.821.1880',
    contactPhoneRaw: '5028211880',
  },
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

export const TRYOUT_LOCATION = {
  name: 'Watkins Church',
  address: '9800 Westport Road',
  cityState: 'Louisville, KY 40241',
  mapsQuery: 'Watkins Church, 9800 Westport Road, Louisville, KY 40241',
};

export const TRYOUT_LOOKING_FOR =
  'We are looking for determined, coachable, and hard-working players to join our family.';

export const TRYOUT_MOTTO = 'Built on character. Focused on excellence.';
