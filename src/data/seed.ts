import {
  FREE_CELL_INDEX,
  type DataStore,
  type Entry,
  type Level,
  type Player,
  type Task,
  type Week,
} from './types';

// ---------------------------------------------------------------------------
// Klubb, lag och trupper (spec avsnitt 6)
// ---------------------------------------------------------------------------

const CLUB_ID = 'club-skultuna';

const club = { id: CLUB_ID, name: 'Skultuna IS' };

const teams = [
  { id: 'team-f11', clubId: CLUB_ID, name: 'Flickor 11', joinCode: 'F11-SOL' },
  { id: 'team-f17', clubId: CLUB_ID, name: 'Flickor 17/18', joinCode: 'F17-RÖD' },
  { id: 'team-p13', clubId: CLUB_ID, name: 'Pojkar 13', joinCode: 'P13-BLÅ' },
];

const PLAYER_COLORS = [
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#c026d3',
];

function makePlayers(teamId: string, names: string[], coachName?: string): Player[] {
  const players: Player[] = names.map((firstName, i) => ({
    id: `p-${teamId}-${firstName.toLowerCase()}`,
    teamId,
    firstName,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    role: 'player' as const,
  }));
  if (coachName) {
    players.push({
      id: `p-${teamId}-${coachName.toLowerCase()}`,
      teamId,
      firstName: coachName,
      color: '#475569',
      role: 'coach' as const,
    });
  }
  return players;
}

const players: Player[] = [
  // 8 spelare → tröskel 4 (matchar spec:ens exempel), plus en coach.
  ...makePlayers('team-f11', ['Alva', 'Liam', 'Maja', 'Noah', 'Ella', 'Hugo', 'Wilma', 'Leo'], 'Daniel'),
  ...makePlayers('team-f17', ['Saga', 'Vera', 'Nova', 'Iris', 'Elsa', 'Tuva'], 'Karin'),
  ...makePlayers('team-p13', ['Elias', 'Oscar', 'Vidar', 'Melvin', 'Nils', 'Ludvig', 'Frank', 'Sixten', 'Ivar'], 'Peter'),
];

// ---------------------------------------------------------------------------
// Veckor (delat bibliotek på klubbnivå – spec avsnitt 8, default)
// ---------------------------------------------------------------------------

const weeks: Week[] = [
  {
    id: 'week-teknik',
    teamId: null,
    clubId: CLUB_ID,
    weekNumber: 27,
    theme: 'Teknikveckan',
    dateRange: '29 juni–5 juli',
    status: 'archived',
  },
  {
    id: 'week-kondition',
    teamId: null,
    clubId: CLUB_ID,
    weekNumber: 28,
    theme: 'Kondition & VM',
    dateRange: '6–12 juli',
    status: 'active',
  },
];

// ---------------------------------------------------------------------------
// Uppgifter
// ---------------------------------------------------------------------------

// Aktiv vecka: 24 övningar med tre nivåer (index 12 = FRI).
// [titel, Lätt, Medel, Svår]
const KONDITION: Array<[string, string, string, string] | null> = [
  ['Jonglering', '5 i rad', '20 i rad', '50 i rad utan att tappa'],
  ['Touch mot vägg', '50 touchar', '100 touchar, insida båda fötter', '200 touchar på 2 min utan paus'],
  ['Nick', '5 nickar mot vägg', '15 nickar i rad med kompis', '30 nickar i rad, styr mot mål'],
  ['Eget pass', '10 väggpass insida', '25 pass, växla fot', '50 pass på 90 sek utan miss'],
  ['VM-finta', 'Lär dig en VM-finta', 'Gör den i fart 5 ggr/fot', 'Kombinera två fintor förbi en kon i full fart'],
  ['Dribbling', 'Slalom genom 5 koner', '8 koner tight, båda fötter', '8 koner på tid, under 12 sek'],
  ['Planka', '30 sek', '60 sek', '2 min (eller 3×45 sek)'],
  ['Lär ut', 'Visa en övning för en kompis', 'Lär ut en finta så kompisen klarar den', 'Håll ett eget 10-min pass för minst 2 spelare'],
  ['Svagfot pass', '10 pass med svag fot', '25 pass mot vägg, svag fot', '40 pass svag fot på 2 min'],
  ['Hopprep', '30 hopp', '100 hopp utan miss', '200 hopp eller 3 min non-stop'],
  ['Skott', '3/10 i mål', '6/10 i mål', '8/10 i ett litet mål (hink/koner)'],
  ['Explosivitet', '5 utfallshopp per ben', '10 sprintstarter 10 m', '8×20 m sprint med kort vila'],
  null, // 12 = FRI
  ['Film & analys', 'Se ett proffsklipp och härma en rörelse', 'Filma dig själv och jämför', 'Analysera en match, skriv 3 lärdomar'],
  ['Spela & lek', 'Spela fotboll 20 min', 'Spela 45 min med kompisar', 'Arrangera en liten turnering'],
  ['Egen övning', 'Hitta på en egen övning', 'Gör din övning i 10 min', 'Lär ut din övning till laget'],
  ['Straffar', '3/5 i mål', '5/5 i valfritt hörn', '8/10 placerade i anvisat hörn'],
  ['Svaga foten', '20 touchar med svag fot', 'Dribbla en bana enbart svag fot', 'Gör mål med svag fot 5 ggr'],
  ['Löpning', 'Spring 1 km / cykla 3 km', 'Spring 2 km, ta tiden', 'Spring 3 km eller slå din 2 km-tid med 30 sek'],
  ['Barfota', '5 min bollkänsla barfota', '50 touchar barfota på gräs', 'Jonglera 20 barfota'],
  ['Nya fintor', 'Lär dig 1 ny finta', 'Lär dig 2 nya fintor', 'Använd 3 nya fintor i spel'],
  ['Allround-jong', '10 jonglering med fötterna', 'Fot–lår–fot 10 gånger', 'Fot–lår–huvud–cykel, 15 träffar'],
  ['Inkast', '5 korrekta inkast', 'Kasta 10 m med rätt teknik', 'Kasta 15 m eller längre korrekt'],
  ['Med lagkompis', 'Passa med en kompis 10 min', '30 pass i rad tillsammans', '2-mot-1-övning ihop i 10 min'],
  ['Återhämtning', 'Stretcha 10 min', 'Stretcha + 8 tim sömn', 'Stretch, vätska och sömn 2 dagar i rad'],
];

// Arkiverad vecka: enkla övningar utan nivåer (endast titel).
const TEKNIK: string[] = [
  '50 jong i rad',
  'Insida-utsida x20',
  'Stoppa hög boll x10',
  'Åtta runt koner',
  'Härma VM-vändning',
  'Passningsvägg x30',
  'Tå-touch x50',
  'Lär ut en finta',
  'Svagfotsskott x10',
  'Sula fram-bak 1 min',
  'Träffa ribban x3',
  'Snabba fötter',
  'FRI RUTA',
  'Visa din bästa finta',
  'Cruyff x10/fot',
  'Egen trick-rörelse',
  'Volley mot vägg x10',
  'Dribbla 8 koner',
  'Nick-jong 5 rad',
  'Klackpass x5',
  'Härma målgest',
  'Knä/fot/bröst',
  'Long ball 30 m',
  'Trick med kompis',
  'Stretcha ordentligt',
];

function buildTasks(): Task[] {
  const tasks: Task[] = [];

  KONDITION.forEach((entry, cellIndex) => {
    if (cellIndex === FREE_CELL_INDEX) {
      tasks.push(freeTask('week-kondition'));
      return;
    }
    const [title, easy, medium, hard] = entry!;
    tasks.push({
      id: `week-kondition-t${cellIndex}`,
      weekId: 'week-kondition',
      cellIndex,
      title,
      levelEasyText: easy,
      levelMediumText: medium,
      levelHardText: hard,
      animationUrl: null,
    });
  });

  TEKNIK.forEach((title, cellIndex) => {
    if (cellIndex === FREE_CELL_INDEX) {
      tasks.push(freeTask('week-teknik'));
      return;
    }
    tasks.push({
      id: `week-teknik-t${cellIndex}`,
      weekId: 'week-teknik',
      cellIndex,
      title,
      levelEasyText: null, // enkel vecka → ingen nivåväljare
      levelMediumText: null,
      levelHardText: null,
      animationUrl: null,
    });
  });

  return tasks;
}

function freeTask(weekId: string): Task {
  return {
    id: `${weekId}-t${FREE_CELL_INDEX}`,
    weekId,
    cellIndex: FREE_CELL_INDEX,
    title: 'FRI RUTA',
    levelEasyText: null,
    levelMediumText: null,
    levelHardText: null,
    animationUrl: null,
  };
}

// ---------------------------------------------------------------------------
// Entries (avklarade rutor) – förseedade så alla vyer har innehåll
// ---------------------------------------------------------------------------

let entryCounter = 0;

/** Bygger en entry med en deterministisk tidsstämpel som ger stabil ordning. */
function makeEntry(
  weekId: string,
  playerId: string,
  cellIndex: number,
  level: Level,
  playerOrder: number,
  baseDay: string,
): Entry {
  const base = new Date(`${baseDay}T09:00:00.000Z`).getTime();
  // Senare spelar-ordning = senare tidsstämpel → "senast klarade" blir sista i listan.
  const completedAt = new Date(base + playerOrder * 3_600_000 + cellIndex * 60_000).toISOString();
  return {
    id: `entry-${entryCounter++}`,
    weekId,
    playerId,
    cellIndex,
    level,
    completedAt,
  };
}

// Aktiv vecka, Flickor 11: [cellIndex, level] per spelare (spelar-ordning styr ringen).
const F11_ACTIVE: Record<string, Array<[number, Level]>> = {
  'p-team-f11-alva': [[0, 'S'], [1, 'M'], [2, 'M'], [3, 'S'], [4, 'M'], [5, 'S'], [6, 'M'], [10, 'S'], [18, 'S'], [24, 'L']],
  'p-team-f11-liam': [[0, 'M'], [1, 'L'], [2, 'M'], [5, 'L'], [6, 'L'], [10, 'M'], [18, 'M'], [24, 'L']],
  'p-team-f11-maja': [[0, 'L'], [1, 'M'], [2, 'L'], [5, 'M'], [6, 'M'], [7, 'M'], [10, 'L'], [18, 'L'], [24, 'L']],
  'p-team-f11-noah': [[0, 'M'], [1, 'L'], [5, 'M'], [6, 'S'], [10, 'S'], [18, 'M'], [24, 'L']],
  'p-team-f11-ella': [[0, 'S'], [1, 'M'], [2, 'S'], [3, 'M'], [4, 'S'], [6, 'M'], [10, 'M']],
  'p-team-f11-hugo': [[0, 'L'], [6, 'L'], [10, 'L'], [18, 'L']],
  'p-team-f11-wilma': [[1, 'M'], [2, 'M'], [5, 'L'], [6, 'M']],
  'p-team-f11-leo': [[0, 'L'], [10, 'M'], [18, 'L']],
};

// Arkiverad vecka, Flickor 11: enklare, alla på nivå L.
const F11_TEKNIK: Record<number, string[]> = {
  0: ['alva', 'liam', 'maja', 'noah', 'ella', 'hugo'],
  1: ['alva', 'liam', 'maja', 'noah'],
  5: ['alva', 'maja', 'ella'],
  6: ['alva', 'liam', 'maja', 'noah', 'wilma'],
  7: ['alva', 'ella'],
  13: ['alva', 'liam', 'maja', 'noah', 'ella', 'leo'],
  24: ['alva', 'liam', 'maja', 'noah', 'ella', 'hugo', 'wilma', 'leo'],
};

// Lite innehåll för övriga lag (aktiv vecka) så coach-vyn har data att bläddra i.
const F17_ACTIVE: Record<number, Array<[string, Level]>> = {
  0: [['saga', 'S'], ['vera', 'M'], ['nova', 'L']],
  6: [['saga', 'M'], ['vera', 'M'], ['nova', 'L'], ['iris', 'L']],
  10: [['saga', 'M'], ['vera', 'L']],
};
const P13_ACTIVE: Record<number, Array<[string, Level]>> = {
  0: [['elias', 'M'], ['oscar', 'L'], ['vidar', 'M'], ['melvin', 'L'], ['nils', 'L']],
  10: [['elias', 'S'], ['oscar', 'M']],
  18: [['elias', 'M'], ['vidar', 'L'], ['melvin', 'L']],
};

function buildEntries(): Entry[] {
  const entries: Entry[] = [];
  const f11Order = Object.keys(F11_ACTIVE);

  // F11 aktiv vecka
  f11Order.forEach((playerId, order) => {
    for (const [cellIndex, level] of F11_ACTIVE[playerId]) {
      entries.push(makeEntry('week-kondition', playerId, cellIndex, level, order, '2026-07-06'));
    }
  });

  // F11 arkiverad vecka
  Object.entries(F11_TEKNIK).forEach(([cell, names]) => {
    names.forEach((name, order) => {
      entries.push(makeEntry('week-teknik', `p-team-f11-${name}`, Number(cell), 'L', order, '2026-06-29'));
    });
  });

  // Övriga lag, aktiv vecka
  const addTeam = (teamId: string, data: Record<number, Array<[string, Level]>>) => {
    Object.entries(data).forEach(([cell, list]) => {
      list.forEach(([name, level], order) => {
        entries.push(makeEntry('week-kondition', `p-${teamId}-${name}`, Number(cell), level, order, '2026-07-06'));
      });
    });
  };
  addTeam('team-f17', F17_ACTIVE);
  addTeam('team-p13', P13_ACTIVE);

  return entries;
}

// ---------------------------------------------------------------------------
// Sammansatt seed
// ---------------------------------------------------------------------------

export const SEED_VERSION = 1;

export function createSeedData(): DataStore {
  entryCounter = 0;
  return {
    clubs: [club],
    teams,
    players,
    weeks,
    tasks: buildTasks(),
    entries: buildEntries(),
    teamSettings: teams.map((t) => ({ teamId: t.id, finalUnlockedAt: null })),
    version: SEED_VERSION,
  };
}
