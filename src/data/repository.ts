import { uid } from '../lib/uid';
import { loadStore, resetStore, saveStore } from './localStore';
import {
  FREE_CELL_INDEX,
  type AdventEntry,
  type DataStore,
  type Entry,
  type Level,
  type Task,
  type Week,
  type WeekStatus,
} from './types';

/**
 * Abstraktion över datalagret. Den lokala implementationen nedan använder
 * seed-data + localStorage så att appen fungerar direkt. För att koppla mot
 * Supabase byter man bara ut denna klass mot en variant som gör motsvarande
 * SQL-anrop (schemat finns i /supabase/schema.sql). Varje metod returnerar en
 * färsk ögonblicksbild så att UI-lagret kan uppdatera state på samma sätt
 * oavsett backend.
 */
export interface BingoRepository {
  getSnapshot(): Promise<DataStore>;
  /** Skapar eller uppdaterar en spelares entry för en ruta (byte av nivå = uppdatering). */
  completeCell(weekId: string, playerId: string, cellIndex: number, level: Level): Promise<DataStore>;
  /** Ångrar en avklarad ruta. */
  clearCell(weekId: string, playerId: string, cellIndex: number): Promise<DataStore>;
  /** Sätter status på en vecka (t.ex. arkivering). */
  setWeekStatus(weekId: string, status: WeekStatus): Promise<DataStore>;
  /** Skapar en ny vecka med tillhörande uppgifter och gör den aktiv. */
  createWeek(week: Week, tasks: Task[]): Promise<DataStore>;
  /** Uppdaterar en uppgift (coach redigerar veckans innehåll). */
  updateTask(taskId: string, patch: Partial<Omit<Task, 'id' | 'weekId' | 'cellIndex'>>): Promise<DataStore>;
  /** Låser upp / låser sommarfinalen för ett lag. */
  setFinalUnlocked(teamId: string, unlocked: boolean): Promise<DataStore>;
  /** Markerar en adventslucka som klarad (byte av nivå behåller första tidsstämpeln). */
  completeDoor(calendarId: string, playerId: string, day: number, level: Level, completedAt?: string): Promise<DataStore>;
  /** Ångrar en klarad adventslucka. */
  clearDoor(calendarId: string, playerId: string, day: number): Promise<DataStore>;
  /** Öppnar alla adventsluckor direkt för ett lag (eller återgår till en om dagen). */
  setAdventAllOpen(teamId: string, open: boolean): Promise<DataStore>;
  /** Nollställer till seed-data (demo). */
  reset(): Promise<DataStore>;
}

/** Lokal implementation: en ögonblicksbild i minnet, speglad till localStorage. */
export class LocalRepository implements BingoRepository {
  private db: DataStore;

  constructor() {
    this.db = loadStore();
  }

  private commit(next: DataStore): DataStore {
    this.db = next;
    saveStore(next);
    return snapshot(next);
  }

  async getSnapshot(): Promise<DataStore> {
    return snapshot(this.db);
  }

  async completeCell(weekId: string, playerId: string, cellIndex: number, level: Level): Promise<DataStore> {
    if (cellIndex === FREE_CELL_INDEX) return snapshot(this.db); // FRI-rutan lagras aldrig
    const now = new Date().toISOString();
    const existing = this.db.entries.find(
      (e) => e.weekId === weekId && e.playerId === playerId && e.cellIndex === cellIndex,
    );

    let entries: Entry[];
    if (existing) {
      // Byte av nivå: uppdatera raden och stämpla om tiden (blir "senast klarad").
      entries = this.db.entries.map((e) =>
        e.id === existing.id ? { ...e, level, completedAt: now } : e,
      );
    } else {
      const entry: Entry = {
        id: `entry-${uid()}`,
        weekId,
        playerId,
        cellIndex,
        level,
        completedAt: now,
      };
      entries = [...this.db.entries, entry];
    }
    return this.commit({ ...this.db, entries });
  }

  async clearCell(weekId: string, playerId: string, cellIndex: number): Promise<DataStore> {
    const entries = this.db.entries.filter(
      (e) => !(e.weekId === weekId && e.playerId === playerId && e.cellIndex === cellIndex),
    );
    return this.commit({ ...this.db, entries });
  }

  async setWeekStatus(weekId: string, status: WeekStatus): Promise<DataStore> {
    const weeks = this.db.weeks.map((w) => (w.id === weekId ? { ...w, status } : w));
    return this.commit({ ...this.db, weeks });
  }

  async createWeek(week: Week, tasks: Task[]): Promise<DataStore> {
    // En ny aktiv vecka arkiverar tidigare aktiv(a) veckor i samma klubb.
    const weeks = this.db.weeks.map((w) =>
      w.clubId === week.clubId && w.status === 'active' ? { ...w, status: 'archived' as const } : w,
    );
    return this.commit({
      ...this.db,
      weeks: [...weeks, week],
      tasks: [...this.db.tasks, ...tasks],
    });
  }

  async updateTask(
    taskId: string,
    patch: Partial<Omit<Task, 'id' | 'weekId' | 'cellIndex'>>,
  ): Promise<DataStore> {
    const tasks = this.db.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
    return this.commit({ ...this.db, tasks });
  }

  async setFinalUnlocked(teamId: string, unlocked: boolean): Promise<DataStore> {
    const stamp = unlocked ? new Date().toISOString() : null;
    const existing = this.db.teamSettings.find((s) => s.teamId === teamId);
    const teamSettings = existing
      ? this.db.teamSettings.map((s) => (s.teamId === teamId ? { ...s, finalUnlockedAt: stamp } : s))
      : [...this.db.teamSettings, { teamId, finalUnlockedAt: stamp }];
    return this.commit({ ...this.db, teamSettings });
  }

  async completeDoor(
    calendarId: string,
    playerId: string,
    day: number,
    level: Level,
    completedAt: string = new Date().toISOString(),
  ): Promise<DataStore> {
    const existing = this.db.adventEntries.find(
      (e) => e.calendarId === calendarId && e.playerId === playerId && e.day === day,
    );
    let adventEntries: AdventEntry[];
    if (existing) {
      // Nivåbyte: behåll completedAt så att "klarad i tid" inte går förlorad.
      adventEntries = this.db.adventEntries.map((e) => (e.id === existing.id ? { ...e, level } : e));
    } else {
      adventEntries = [
        ...this.db.adventEntries,
        { id: `advent-${uid()}`, calendarId, playerId, day, level, completedAt },
      ];
    }
    return this.commit({ ...this.db, adventEntries });
  }

  async clearDoor(calendarId: string, playerId: string, day: number): Promise<DataStore> {
    const adventEntries = this.db.adventEntries.filter(
      (e) => !(e.calendarId === calendarId && e.playerId === playerId && e.day === day),
    );
    return this.commit({ ...this.db, adventEntries });
  }

  async setAdventAllOpen(teamId: string, open: boolean): Promise<DataStore> {
    const stamp = open ? new Date().toISOString() : null;
    const existing = this.db.teamSettings.find((s) => s.teamId === teamId);
    const teamSettings = existing
      ? this.db.teamSettings.map((s) => (s.teamId === teamId ? { ...s, adventAllOpenAt: stamp } : s))
      : [...this.db.teamSettings, { teamId, finalUnlockedAt: null, adventAllOpenAt: stamp }];
    return this.commit({ ...this.db, teamSettings });
  }

  async reset(): Promise<DataStore> {
    this.db = resetStore();
    return snapshot(this.db);
  }
}

/** Djup(are) kopia så att konsumenter inte muterar det interna lagret. */
function snapshot(db: DataStore): DataStore {
  return {
    clubs: db.clubs.map((c) => ({ ...c })),
    teams: db.teams.map((t) => ({ ...t })),
    players: db.players.map((p) => ({ ...p })),
    weeks: db.weeks.map((w) => ({ ...w })),
    tasks: db.tasks.map((t) => ({ ...t })),
    entries: db.entries.map((e) => ({ ...e })),
    teamSettings: db.teamSettings.map((s) => ({ ...s })),
    adventCalendars: db.adventCalendars.map((c) => ({ ...c })),
    adventDoors: db.adventDoors.map((d) => ({ ...d })),
    adventEntries: db.adventEntries.map((e) => ({ ...e })),
    version: db.version,
  };
}

/** Standardinstans som appen använder. Byt ut mot en SupabaseRepository här. */
export const repository: BingoRepository = new LocalRepository();
