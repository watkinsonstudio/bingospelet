// Domänmodell för Föreningens Sommarbingo.
// Modellen speglar spec:en (avsnitt 3) och är medvetet enkel så att den kan
// mappas rakt av mot en Supabase-databas (se /supabase/schema.sql).

/** Svårighetsnivå per ruta. L = Lätt (1p), M = Medel (2p), S = Svår (3p). */
export type Level = 'L' | 'M' | 'S';

/** Roll för en spelare. Coach har adminrättigheter i UI:t. */
export type Role = 'player' | 'coach';

/** Livscykel för en veckas bricka. */
export type WeekStatus = 'upcoming' | 'active' | 'archived';

export interface Club {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  clubId: string;
  name: string;
  /** Lag-kod som spelaren anger vid inloggning, t.ex. "F11-SOL". */
  joinCode: string;
}

export interface Player {
  id: string;
  teamId: string;
  firstName: string;
  /** Färg för avatar-/bidragsmärken (CSS-färg). */
  color: string;
  role: Role;
}

export interface Week {
  id: string;
  /** Om null är veckan delad på klubbnivå (gemensamt bibliotek). */
  teamId: string | null;
  clubId: string;
  weekNumber: number;
  theme: string;
  dateRange: string;
  status: WeekStatus;
}

export interface Task {
  id: string;
  weekId: string;
  /** 0–24. Index 12 är alltid FRI-rutan. */
  cellIndex: number;
  title: string;
  /**
   * Nivåtexter. En vecka kan vara enkel (endast easy satt → ingen nivåväljare,
   * räknas som 1 poäng) eller ha alla tre nivåer.
   */
  levelEasyText: string | null;
  levelMediumText: string | null;
  levelHardText: string | null;
  /** Demo-animation/video. Fylls på i senare versioner. */
  animationUrl: string | null;
}

export interface Entry {
  id: string;
  weekId: string;
  playerId: string;
  cellIndex: number;
  level: Level;
  /** ISO-tidsstämpel. Ger både "senast klarade" och "vem var först". */
  completedAt: string;
}

/** Runtime-inställningar per lag (t.ex. sommarfinalen upplåst). */
export interface TeamSettings {
  teamId: string;
  /** ISO-tidsstämpel när coachen låste upp finalen, annars null. */
  finalUnlockedAt: string | null;
  /**
   * ISO-tidsstämpel när coachen öppnade alla adventsluckor direkt
   * (förhandsvisning / komma ikapp), annars null = luckorna öppnas dag för dag.
   */
  adventAllOpenAt?: string | null;
}

// ---------------------------------------------------------------------------
// Adventskalendern – 24 luckor med utmaningar, en per dag 1–24 december.
// ---------------------------------------------------------------------------

/** Var utmaningen passar att göra – visas som en liten etikett. */
export type AdventPlace = 'inne' | 'ute' | 'hemma' | 'överallt';

export interface AdventCalendar {
  id: string;
  clubId: string;
  /** Året vars december kalendern gäller. */
  year: number;
  title: string;
}

export interface AdventDoor {
  id: string;
  calendarId: string;
  /** Dag i december, 1–24. */
  day: number;
  title: string;
  emoji: string;
  /** Kort julig ingress som visas när luckan öppnas. */
  intro: string;
  place: AdventPlace;
  levelEasyText: string;
  levelMediumText: string;
  levelHardText: string;
}

export interface AdventEntry {
  id: string;
  calendarId: string;
  playerId: string;
  day: number;
  level: Level;
  /** ISO-tidsstämpel för första gången luckan klarades (ändras inte vid nivåbyte). */
  completedAt: string;
}

/** Hela datalagrets ögonblicksbild – motsvarar tabellerna i databasen. */
export interface DataStore {
  clubs: Club[];
  teams: Team[];
  players: Player[];
  weeks: Week[];
  tasks: Task[];
  entries: Entry[];
  teamSettings: TeamSettings[];
  adventCalendars: AdventCalendar[];
  adventDoors: AdventDoor[];
  adventEntries: AdventEntry[];
  /** Schemaversion för migrering av localStorage-data. */
  version: number;
}

/** Fri-rutans index i brickan. */
export const FREE_CELL_INDEX = 12;

/** Antal rutor i brickan (5×5). */
export const CELL_COUNT = 25;

/** Poängvärde per nivå. */
export const LEVEL_POINTS: Record<Level, number> = { L: 1, M: 2, S: 3 };

/** Etiketter för nivåerna i UI:t. */
export const LEVEL_LABELS: Record<Level, string> = {
  L: 'Lätt',
  M: 'Medel',
  S: 'Svår',
};
