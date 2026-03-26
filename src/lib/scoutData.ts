export interface AtBat {
  description: string
  result: 'hit' | 'out' | 'strikeout'
  /** Spray chart position as percentage (0-100). x: 0=left foul, 50=center, 100=right foul. y: 0=deep OF, 100=home plate */
  location?: { x: number; y: number }
}

export interface ScoutPlayer {
  number: string
  lastName: string
  firstName: string
  avg: string
  hits: number
  atBats: number
  singles: number
  doubles: number
  triples: number
  homeRuns: number
  rbi: number
  strikeouts: number
  walks: number
  summary: string
  plays: AtBat[]
}

export interface ScoutTeam {
  id: string
  name: string
  gameDate: string
  teamAvg: string
  players: ScoutPlayer[]
}

export const scoutTeams: ScoutTeam[] = [
  {
    id: 'bullitt-bats',
    name: 'Bullitt Bats 7U Stearns',
    gameDate: 'Spring 2026',
    teamAvg: '.440',
    players: [
      {
        number: '00',
        lastName: 'P',
        firstName: 'Colton',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Ground ball hitter. Singled up the middle.',
        plays: [
          { description: 'Singled on a ground ball', result: 'hit', location: { x: 50, y: 60 } },
          { description: 'Grounded out', result: 'out', location: { x: 55, y: 65 } },
        ],
      },
      {
        number: '7',
        lastName: 'W',
        firstName: 'Hudsyn',
        avg: '.500',
        hits: 1, atBats: 2, singles: 0, doubles: 0, triples: 1, homeRuns: 0,
        rbi: 2, strikeouts: 0, walks: 0,
        summary: 'Power hitter. Tripled to short CF. Also grounds to 2B side.',
        plays: [
          { description: 'Grounded out to second baseman', result: 'out', location: { x: 62, y: 52 } },
          { description: 'Tripled on a fly ball to short fielder', result: 'hit', location: { x: 55, y: 22 } },
        ],
      },
      {
        number: '20',
        lastName: 'B',
        firstName: 'Tucker',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Hits line drives to left field. Also hit into FC.',
        plays: [
          { description: 'Singled on a line drive to left fielder', result: 'hit', location: { x: 25, y: 30 } },
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 38, y: 55 } },
        ],
      },
      {
        number: '44',
        lastName: 'E',
        firstName: 'Charlie',
        avg: '.500',
        hits: 1, atBats: 2, singles: 0, doubles: 1, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 1, walks: 0,
        summary: 'Fly ball hitter to right side. Doubled to 1B area. Can strike out.',
        plays: [
          { description: 'Doubled on a fly ball to first baseman', result: 'hit', location: { x: 75, y: 48 } },
          { description: 'Struck out', result: 'strikeout' },
        ],
      },
      {
        number: '99',
        lastName: 'S',
        firstName: 'Rhett',
        avg: '.000',
        hits: 0, atBats: 2, singles: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 2, walks: 0,
        summary: 'Struck out both at-bats. Struggles to make contact.',
        plays: [
          { description: 'Struck out', result: 'strikeout' },
          { description: 'Struck out looking', result: 'strikeout' },
        ],
      },
      {
        number: '3',
        lastName: 'W',
        firstName: 'Connor',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 1, strikeouts: 0, walks: 0,
        summary: 'Hits to the right side. Grounded out and singled, both toward 2B.',
        plays: [
          { description: 'Grounded out to second baseman', result: 'out', location: { x: 62, y: 50 } },
          { description: 'Singled on a fly ball to second baseman', result: 'hit', location: { x: 65, y: 38 } },
        ],
      },
      {
        number: '5',
        lastName: 'M',
        firstName: 'Myles',
        avg: '.333',
        hits: 1, atBats: 3, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Ground ball hitter to left side. Singled to 3B. Popped out to pitcher.',
        plays: [
          { description: 'Singled on a ground ball to third baseman', result: 'hit', location: { x: 30, y: 55 } },
          { description: 'Popped out to pitcher', result: 'out', location: { x: 52, y: 58 } },
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 42, y: 50 } },
        ],
      },
      {
        number: '6',
        lastName: 'C',
        firstName: 'Kason',
        avg: '1.000',
        hits: 2, atBats: 2, singles: 2, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Their best hitter. 2-for-2. Fly balls up the middle — CF and pitcher area.',
        plays: [
          { description: 'Singled on a fly ball to center fielder', result: 'hit', location: { x: 48, y: 22 } },
          { description: 'Singled on a pop fly to pitcher', result: 'hit', location: { x: 50, y: 55 } },
        ],
      },
      {
        number: '10',
        lastName: 'U',
        firstName: 'Griffin',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 1, walks: 0,
        summary: 'Ground ball to 3B side. Can strike out.',
        plays: [
          { description: 'Singled on a ground ball to third baseman', result: 'hit', location: { x: 22, y: 55 } },
          { description: 'Struck out', result: 'strikeout' },
        ],
      },
      {
        number: '24',
        lastName: 'S',
        firstName: 'Journey',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Grounds up the middle. Hit into FC and singled to pitcher.',
        plays: [
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 42, y: 50 } },
          { description: 'Singled on a ground ball to pitcher', result: 'hit', location: { x: 50, y: 58 } },
        ],
      },
      {
        number: '28',
        lastName: 'L',
        firstName: 'Memphis',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 1, strikeouts: 1, walks: 0,
        summary: 'Ground ball to pitcher. Can strike out.',
        plays: [
          { description: 'Singled on a ground ball to pitcher', result: 'hit', location: { x: 50, y: 58 } },
          { description: 'Struck out', result: 'strikeout' },
        ],
      },
      {
        number: '-',
        lastName: 'B',
        firstName: 'Kaysn',
        avg: '.000',
        hits: 0, atBats: 2, singles: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 2, walks: 0,
        summary: 'Struck out both at-bats. No contact.',
        plays: [
          { description: 'Struck out', result: 'strikeout' },
          { description: 'Struck out', result: 'strikeout' },
        ],
      },
    ],
  },
  {
    id: 'rbi-bulls',
    name: 'RBI Bulls 7U',
    gameDate: 'Spring 2026',
    teamAvg: '.414',
    players: [
      {
        number: '1',
        lastName: 'L',
        firstName: 'Blake',
        avg: '1.000',
        hits: 2, atBats: 2, singles: 2, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 1, strikeouts: 0, walks: 0,
        summary: 'Their ace. 2-for-2. GB to 2B side + LD to short CF. Also pitched 6 IP.',
        plays: [
          { description: 'Singled on a ground ball to second baseman', result: 'hit', location: { x: 62, y: 48 } },
          { description: 'Singled on a line drive to short fielder', result: 'hit', location: { x: 55, y: 28 } },
        ],
      },
      {
        number: '22',
        lastName: 'F',
        firstName: 'Liam',
        avg: '.500',
        hits: 1, atBats: 2, singles: 0, doubles: 1, triples: 0, homeRuns: 0,
        rbi: 1, strikeouts: 0, walks: 0,
        summary: 'Extra-base power to left side. Doubled on fly to SS. Grounded out to 3B.',
        plays: [
          { description: 'Doubled on a fly ball to shortstop', result: 'hit', location: { x: 38, y: 40 } },
          { description: 'Grounded out to third baseman', result: 'out', location: { x: 28, y: 55 } },
        ],
      },
      {
        number: '95',
        lastName: 'R',
        firstName: 'Connor',
        avg: '.500',
        hits: 1, atBats: 2, singles: 0, doubles: 1, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Hits to left side. Doubled on GB to SS. Grounded out to pitcher.',
        plays: [
          { description: 'Grounded out to pitcher', result: 'out', location: { x: 55, y: 55 } },
          { description: 'Doubled on a ground ball to shortstop', result: 'hit', location: { x: 38, y: 42 } },
        ],
      },
      {
        number: '5',
        lastName: 'P',
        firstName: 'Param',
        avg: '.333',
        hits: 1, atBats: 3, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 1, strikeouts: 1, walks: 0,
        summary: 'Hits to left side. Grounded out to SS, singled hard GB to short fielder. Can K.',
        plays: [
          { description: 'Grounded out to shortstop', result: 'out', location: { x: 35, y: 48 } },
          { description: 'Singled on a hard ground ball to short fielder', result: 'hit', location: { x: 55, y: 28 } },
          { description: 'Struck out', result: 'strikeout' },
        ],
      },
      {
        number: '8',
        lastName: 'L',
        firstName: 'Waylon',
        avg: '.667',
        hits: 2, atBats: 3, singles: 1, doubles: 0, triples: 1, homeRuns: 0,
        rbi: 1, strikeouts: 0, walks: 0,
        summary: 'Dangerous. 2-for-3 with a triple. Hits hard to left/center — SS and short fielder.',
        plays: [
          { description: 'Grounded out to shortstop', result: 'out', location: { x: 35, y: 48 } },
          { description: 'Tripled on a hard ground ball to short fielder', result: 'hit', location: { x: 55, y: 28 } },
          { description: 'Singled on a ground ball', result: 'hit', location: { x: 42, y: 55 } },
        ],
      },
      {
        number: '3',
        lastName: 'A',
        firstName: 'Max',
        avg: '.333',
        hits: 1, atBats: 3, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 1, strikeouts: 0, walks: 0,
        summary: 'Sprays the ball. Grounded out to SS and 1B. Pop fly single to 3B side.',
        plays: [
          { description: 'Grounded out to shortstop', result: 'out', location: { x: 42, y: 45 } },
          { description: 'Grounded out to first baseman', result: 'out', location: { x: 72, y: 55 } },
          { description: 'Singled on a pop fly to third baseman', result: 'hit', location: { x: 25, y: 55 } },
        ],
      },
      {
        number: '7',
        lastName: 'M',
        firstName: 'Woodford',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Hits up the middle. FC near SS, singled GB to short fielder.',
        plays: [
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 35, y: 48 } },
          { description: 'Singled on a ground ball to short fielder', result: 'hit', location: { x: 55, y: 30 } },
        ],
      },
      {
        number: '11',
        lastName: 'G',
        firstName: 'Tytus',
        avg: '.500',
        hits: 1, atBats: 2, singles: 1, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 1, walks: 0,
        summary: 'Ground ball to pitcher. Can strike out.',
        plays: [
          { description: 'Singled on a ground ball to pitcher', result: 'hit', location: { x: 52, y: 58 } },
          { description: 'Struck out', result: 'strikeout' },
        ],
      },
      {
        number: '14',
        lastName: 'D',
        firstName: 'Ryker',
        avg: '.000',
        hits: 0, atBats: 3, singles: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'No hits. Flies out to right side. Grounds out to 2B. Weak contact.',
        plays: [
          { description: 'Flew out to first baseman', result: 'out', location: { x: 72, y: 52 } },
          { description: 'Grounded out to second baseman', result: 'out', location: { x: 62, y: 45 } },
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 50, y: 55 } },
        ],
      },
      {
        number: '15',
        lastName: 'R',
        firstName: 'Royce',
        avg: '1.000',
        hits: 2, atBats: 2, singles: 2, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'Perfect 2-for-2. Fly ball single over 2B, ground ball single to pitcher.',
        plays: [
          { description: 'Singled on a fly ball to second baseman', result: 'hit', location: { x: 62, y: 40 } },
          { description: 'Singled on a ground ball to pitcher', result: 'hit', location: { x: 50, y: 55 } },
        ],
      },
      {
        number: '18',
        lastName: 'J',
        firstName: 'Boone',
        avg: '.000',
        hits: 0, atBats: 3, singles: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'No hits in 3 ABs. Grounds to 3B side and pitcher. Weak contact everywhere.',
        plays: [
          { description: 'Grounded out to third baseman', result: 'out', location: { x: 28, y: 55 } },
          { description: 'Grounded out to pitcher', result: 'out', location: { x: 42, y: 42 } },
          { description: 'Grounded out to first baseman', result: 'out', location: { x: 58, y: 55 } },
        ],
      },
      {
        number: '29',
        lastName: 'C',
        firstName: 'Benny',
        avg: '.000',
        hits: 0, atBats: 2, singles: 0, doubles: 0, triples: 0, homeRuns: 0,
        rbi: 0, strikeouts: 0, walks: 0,
        summary: 'No hits. Both FCs — one to short CF, one to right side. Weak ground balls.',
        plays: [
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 42, y: 30 } },
          { description: 'Grounded into fielder\'s choice', result: 'out', location: { x: 62, y: 45 } },
        ],
      },
    ],
  },
]
