import { uid } from '../lib/uid';
import { loadStore, resetStore, saveStore } from './localStore';
import type { DataStore, Intent, Person, Session, Signup, SignupStatus } from './types';

/**
 * Abstraktion över datalagret. Den lokala implementationen nedan använder
 * demodata + localStorage så att utkastet fungerar direkt i webbläsaren. För att
 * koppla mot Supabase byter man bara ut klassen mot en variant som gör
 * motsvarande SQL-anrop (schemat finns i /supabase/schema.sql) – domänlogiken
 * och alla vyer är oförändrade. Varje metod returnerar en färsk ögonblicksbild.
 */
export interface SpontanRepository {
  getSnapshot(): Promise<DataStore>;
  /** Lägger till en profil (första gången någon öppnar appen). */
  createPerson(person: Person): Promise<DataStore>;
  /** Uppdaterar en profil (namn, färg, favoritaktiviteter). */
  updatePerson(personId: string, patch: Partial<Omit<Person, 'id' | 'areaId'>>): Promise<DataStore>;
  /** Skapar ett pass. Värden anmäls automatiskt som "ja". */
  createSession(session: Session): Promise<DataStore>;
  /** Ändrar ett pass (tid, plats, antal …). Endast värden gör detta i UI:t. */
  updateSession(
    sessionId: string,
    patch: Partial<Omit<Session, 'id' | 'areaId' | 'hostId' | 'createdAt'>>,
  ): Promise<DataStore>;
  /** Ställer in eller återupptar ett pass. */
  setSessionCancelled(sessionId: string, cancelled: boolean): Promise<DataStore>;
  /** Ja / kanske / nej på ett pass (skapar eller uppdaterar svaret). */
  setSignup(sessionId: string, personId: string, status: SignupStatus): Promise<DataStore>;
  /** Tar bort ett svar helt (personen har inte tagit ställning). */
  clearSignup(sessionId: string, personId: string): Promise<DataStore>;
  /** Sparar personens sugen-status. Ersätter en tidigare – en aktiv per person. */
  saveIntent(intent: Intent): Promise<DataStore>;
  /** Tar bort personens sugen-status ("jag är inte sugen längre"). */
  clearIntent(personId: string): Promise<DataStore>;
  /** Nollställer till demodata. */
  reset(): Promise<DataStore>;
}

/** Lokal implementation: en ögonblicksbild i minnet, speglad till localStorage. */
export class LocalRepository implements SpontanRepository {
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

  async createPerson(person: Person): Promise<DataStore> {
    return this.commit({ ...this.db, people: [...this.db.people, person] });
  }

  async updatePerson(
    personId: string,
    patch: Partial<Omit<Person, 'id' | 'areaId'>>,
  ): Promise<DataStore> {
    const people = this.db.people.map((p) => (p.id === personId ? { ...p, ...patch } : p));
    return this.commit({ ...this.db, people });
  }

  async createSession(session: Session): Promise<DataStore> {
    // Den som startar passet räknas alltid som "ja" – annars kan ett pass stå
    // med noll anmälda fastän någon står på planen.
    const hostSignup: Signup = {
      id: `signup-${uid()}`,
      sessionId: session.id,
      personId: session.hostId,
      status: 'ja',
      createdAt: new Date().toISOString(),
    };
    return this.commit({
      ...this.db,
      sessions: [...this.db.sessions, session],
      signups: [...this.db.signups, hostSignup],
    });
  }

  async updateSession(
    sessionId: string,
    patch: Partial<Omit<Session, 'id' | 'areaId' | 'hostId' | 'createdAt'>>,
  ): Promise<DataStore> {
    const sessions = this.db.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
    return this.commit({ ...this.db, sessions });
  }

  async setSessionCancelled(sessionId: string, cancelled: boolean): Promise<DataStore> {
    return this.updateSession(sessionId, { status: cancelled ? 'cancelled' : 'open' });
  }

  async setSignup(sessionId: string, personId: string, status: SignupStatus): Promise<DataStore> {
    const existing = this.db.signups.find(
      (s) => s.sessionId === sessionId && s.personId === personId,
    );
    let signups: Signup[];
    if (existing) {
      // Behåll createdAt: köordningen ska inte ändras för att någon byter
      // "kanske" mot "ja" och tillbaka.
      signups = this.db.signups.map((s) => (s.id === existing.id ? { ...s, status } : s));
    } else {
      signups = [
        ...this.db.signups,
        {
          id: `signup-${uid()}`,
          sessionId,
          personId,
          status,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return this.commit({ ...this.db, signups });
  }

  async clearSignup(sessionId: string, personId: string): Promise<DataStore> {
    const signups = this.db.signups.filter(
      (s) => !(s.sessionId === sessionId && s.personId === personId),
    );
    return this.commit({ ...this.db, signups });
  }

  async saveIntent(intent: Intent): Promise<DataStore> {
    const intents = [...this.db.intents.filter((i) => i.personId !== intent.personId), intent];
    return this.commit({ ...this.db, intents });
  }

  async clearIntent(personId: string): Promise<DataStore> {
    const intents = this.db.intents.filter((i) => i.personId !== personId);
    return this.commit({ ...this.db, intents });
  }

  async reset(): Promise<DataStore> {
    this.db = resetStore();
    return snapshot(this.db);
  }
}

/** Djup(are) kopia så att konsumenter inte muterar det interna lagret. */
function snapshot(db: DataStore): DataStore {
  return {
    areas: db.areas.map((a) => ({ ...a })),
    people: db.people.map((p) => ({ ...p, favoriteTypes: [...p.favoriteTypes] })),
    venues: db.venues.map((v) => ({ ...v })),
    sessions: db.sessions.map((s) => ({ ...s })),
    signups: db.signups.map((s) => ({ ...s })),
    intents: db.intents.map((i) => ({
      ...i,
      types: [...i.types],
      weekdays: [...i.weekdays],
      dayparts: [...i.dayparts],
    })),
    version: db.version,
  };
}

/** Standardinstans som appen använder. Byt ut mot en SupabaseRepository här. */
export const repository: SpontanRepository = new LocalRepository();
