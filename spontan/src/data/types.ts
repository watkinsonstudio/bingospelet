// Domänmodell för Spontan – appen för spontanfotboll.
// Medvetet platt och enkel så att den kan mappas rakt av mot en Supabase-databas
// (se /supabase/schema.sql). Samma upplägg som systerappen Sommarbingo, men helt
// egen datamodell: här handlar allt om *pass* (något som händer på en plan vid en
// tid) och *sugen-status* (att någon vill spela, utan att tid är bestämd ännu).

/** Vad passet går ut på. Styr ikon, färg och rimliga standardvärden. */
export type ActivityType = 'match' | 'spontan' | 'teknik' | 'kondition' | 'malvakt' | 'annat';

/** Ambitionsnivå – sätts av den som startar passet så att ingen kommer fel. */
export type Vibe = 'alla' | 'lugnt' | 'tavling';

/** Underlag på planen. Rent informativt, men avgörande i november. */
export type Surface = 'gras' | 'konstgras' | 'grus' | 'inomhus' | 'asfalt';

/** Svar på ett pass. `reserv` sätts aldrig manuellt – den räknas fram vid fullt pass. */
export type SignupStatus = 'ja' | 'kanske' | 'nej';

/** Lagrat läge för ett pass. Övriga lägen (pågår/avslutat) räknas fram ur klockan. */
export type SessionStatus = 'open' | 'cancelled';

/** Grov tid på dygnet – används för sugen-status där exakt klockslag inte finns. */
export type Daypart = 'morgon' | 'lunch' | 'eftermiddag' | 'kvall';

/** Ett område/en ort. Grupperar folk, planer och pass. Motsvarar "klubben" i bingon. */
export interface Area {
  id: string;
  name: string;
  /** Kod som man anger första gången, t.ex. "SKULTUNA". */
  joinCode: string;
}

export interface Person {
  id: string;
  areaId: string;
  name: string;
  /** Färg för avatar (CSS-färg). */
  color: string;
  /** Vad personen normalt är sugen på – förifyller formulär. */
  favoriteTypes: ActivityType[];
}

export interface Venue {
  id: string;
  areaId: string;
  name: string;
  surface: Surface;
  /** Fri text: "grinden mot skolan är öppen", "ta med egna västar". */
  note: string | null;
}

/** Ett pass: någon har satt tid och plats, andra kan anmäla sig. */
export interface Session {
  id: string;
  areaId: string;
  /** Den som startade passet. Får ställa in och ändra. */
  hostId: string;
  type: ActivityType;
  venueId: string;
  /** ISO-tidsstämpel för start. */
  startsAt: string;
  durationMin: number;
  /** Så många måste vara "ja" för att passet ska bli av. */
  minPlayers: number;
  /** Tak för antal "ja". null = inget tak (resten blir aldrig reserver). */
  maxPlayers: number | null;
  vibe: Vibe;
  note: string | null;
  status: SessionStatus;
  createdAt: string;
}

/** En persons svar på ett pass. Ordningen (createdAt) avgör vem som får plats. */
export interface Signup {
  id: string;
  sessionId: string;
  personId: string;
  status: SignupStatus;
  createdAt: string;
}

/**
 * "Jag är sugen" – behovet appen egentligen finns för. Ingen tid är bestämd:
 * personen säger vad hen vill göra och ungefär när. När flera sugna överlappar
 * föreslår appen ett pass som någon kan starta med två knapptryck.
 */
export interface Intent {
  id: string;
  personId: string;
  areaId: string;
  types: ActivityType[];
  /** 0 = söndag … 6 = lördag (samma som Date#getDay). Tom lista = alla dagar. */
  weekdays: number[];
  /** Tom lista = när som helst på dygnet. */
  dayparts: Daypart[];
  note: string | null;
  createdAt: string;
  /** ISO-tidsstämpel. Sugen-status dör av sig själv – inget gammalt skräp i flödet. */
  expiresAt: string;
}

/** Hela datalagrets ögonblicksbild – motsvarar tabellerna i databasen. */
export interface DataStore {
  areas: Area[];
  people: Person[];
  venues: Venue[];
  sessions: Session[];
  signups: Signup[];
  intents: Intent[];
  /** Schemaversion för migrering av localStorage-data. */
  version: number;
}

// --- Presentationsdata (etiketter, ikoner, standardvärden) -------------------

export interface ActivityMeta {
  label: string;
  /** Kort form för chips och listor. */
  short: string;
  emoji: string;
  /** Förklarande rad i formuläret. */
  hint: string;
  defaultMin: number;
  defaultMax: number | null;
  defaultDurationMin: number;
}

export const ACTIVITY_META: Record<ActivityType, ActivityMeta> = {
  match: {
    label: 'Matchspel',
    short: 'Match',
    emoji: '⚽️',
    hint: 'Smålagsspel eller riktig match – kräver att ni blir tillräckligt många.',
    defaultMin: 8,
    defaultMax: 16,
    defaultDurationMin: 90,
  },
  spontan: {
    label: 'Spontanträning',
    short: 'Spontan',
    emoji: '🥅',
    hint: 'Fri bollek: skjuta, spela vägg, straffar, en-mot-en.',
    defaultMin: 2,
    defaultMax: null,
    defaultDurationMin: 60,
  },
  teknik: {
    label: 'Teknikpass',
    short: 'Teknik',
    emoji: '🎯',
    hint: 'Passningar, mottagningar, dribbling, avslut – med lite struktur.',
    defaultMin: 2,
    defaultMax: 12,
    defaultDurationMin: 60,
  },
  kondition: {
    label: 'Löp & kondition',
    short: 'Kondition',
    emoji: '🏃',
    hint: 'Intervaller, distans eller fyspass. Går att köra även om ni är få.',
    defaultMin: 1,
    defaultMax: null,
    defaultDurationMin: 45,
  },
  malvakt: {
    label: 'Målvaktspass',
    short: 'Målvakt',
    emoji: '🧤',
    hint: 'Målvakt söker skyttar – eller tvärtom.',
    defaultMin: 2,
    defaultMax: 8,
    defaultDurationMin: 45,
  },
  annat: {
    label: 'Annat',
    short: 'Annat',
    emoji: '✨',
    hint: 'Beskriv i noteringen vad ni ska hitta på.',
    defaultMin: 2,
    defaultMax: null,
    defaultDurationMin: 60,
  },
};

export const ACTIVITY_TYPES: ActivityType[] = [
  'match',
  'spontan',
  'teknik',
  'kondition',
  'malvakt',
  'annat',
];

export const VIBE_LABELS: Record<Vibe, string> = {
  alla: 'Alla är välkomna',
  lugnt: 'Lugnt tempo',
  tavling: 'Tävlingsinriktat',
};

export const SURFACE_LABELS: Record<Surface, string> = {
  gras: 'Gräs',
  konstgras: 'Konstgräs',
  grus: 'Grus',
  inomhus: 'Inomhus',
  asfalt: 'Asfalt',
};

export const DAYPARTS: Daypart[] = ['morgon', 'lunch', 'eftermiddag', 'kvall'];

export const DAYPART_LABELS: Record<Daypart, string> = {
  morgon: 'Morgon',
  lunch: 'Lunch',
  eftermiddag: 'Eftermiddag',
  kvall: 'Kväll',
};

/** Halvöppna intervall [från, till) i lokal timme. Kväll sträcker sig till midnatt. */
export const DAYPART_HOURS: Record<Daypart, [number, number]> = {
  morgon: [5, 10],
  lunch: [10, 14],
  eftermiddag: [14, 18],
  kvall: [18, 24],
};

/** Veckodagar i Date#getDay-ordning (0 = söndag). */
export const WEEKDAY_LABELS = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];

/** Så länge en sugen-status gäller om inget annat väljs. */
export const INTENT_DEFAULT_DAYS = 7;

/** Färgpalett för nya profiler. */
export const AVATAR_COLORS = [
  '#1f7a4d',
  '#c1121f',
  '#2563a8',
  '#c97d1f',
  '#7b3fa0',
  '#0e7c86',
  '#a8452b',
  '#4a6d1f',
];
