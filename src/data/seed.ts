import { FREE_CELL_INDEX, type DataStore, type Player, type Task, type Week } from './types';
import { ROSTER } from './roster';

// ---------------------------------------------------------------------------
// Klubb, lag och trupper – byggs från föreningens riktiga medlemslista
// (src/data/roster.ts). Endast förnamn + efternamnets första bokstav lagras.
// ---------------------------------------------------------------------------

const CLUB_ID = 'club-skultuna';

const club = { id: CLUB_ID, name: 'Skultuna IS' };

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
const COACH_COLOR = '#475569';

const teams = ROSTER.map((t) => ({
  id: `team-${t.slug}`,
  clubId: CLUB_ID,
  name: t.name,
  joinCode: t.joinCode,
}));

const players: Player[] = ROSTER.flatMap((team) => {
  let colorIndex = 0;
  return team.members.map((m, i) => ({
    id: `p-${team.slug}-${i}`,
    teamId: `team-${team.slug}`,
    firstName: m.name,
    color: m.role === 'coach' ? COACH_COLOR : PLAYER_COLORS[colorIndex++ % PLAYER_COLORS.length],
    role: m.role,
  }));
});

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
// Sammansatt seed
// ---------------------------------------------------------------------------

// v2: riktiga trupper från medlemslistan, tomma brickor (ingen förseedad
// aktivitet med riktiga spelare). Bumpad version → localStorage seedas om.
export const SEED_VERSION = 2;

export function createSeedData(): DataStore {
  return {
    clubs: [club],
    teams,
    players,
    weeks,
    tasks: buildTasks(),
    entries: [],
    teamSettings: teams.map((t) => ({ teamId: t.id, finalUnlockedAt: null })),
    version: SEED_VERSION,
  };
}
