import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { repository } from '../data/repository';
import { uid } from '../lib/uid';
import { AVATAR_COLORS, INTENT_DEFAULT_DAYS } from '../data/types';
import type {
  ActivityType,
  DataStore,
  Daypart,
  Intent,
  Person,
  Session,
  SignupStatus,
  Vibe,
} from '../data/types';
import { getPerson } from '../domain/selectors';

const AUTH_KEY = 'spontan:auth';

/** Klockan uppdateras med jämna mellanrum så att "om 40 min" inte fryser. */
const CLOCK_TICK_MS = 30_000;

export interface NewSessionInput {
  type: ActivityType;
  venueId: string;
  startsAt: Date;
  durationMin: number;
  minPlayers: number;
  maxPlayers: number | null;
  vibe: Vibe;
  note: string | null;
}

export interface NewIntentInput {
  types: ActivityType[];
  weekdays: number[];
  dayparts: Daypart[];
  note: string | null;
  /** Antal dagar sugen-statusen ska gälla. */
  days?: number;
}

interface SpontanContextValue {
  db: DataStore;
  /** "Nu" som appen räknar med – tickar så att pass byter läge av sig själva. */
  now: Date;
  currentPersonId: string | null;
  areaId: string | null;

  login: (personId: string) => void;
  logout: () => void;
  joinAsNew: (areaId: string, name: string, favoriteTypes: ActivityType[]) => Promise<void>;
  updateProfile: (patch: Partial<Omit<Person, 'id' | 'areaId'>>) => Promise<void>;

  createSession: (input: NewSessionInput) => Promise<string | null>;
  updateSession: (sessionId: string, patch: Partial<NewSessionInput>) => Promise<void>;
  setSessionCancelled: (sessionId: string, cancelled: boolean) => Promise<void>;
  respond: (sessionId: string, status: SignupStatus) => Promise<void>;
  clearResponse: (sessionId: string) => Promise<void>;

  saveIntent: (input: NewIntentInput) => Promise<void>;
  clearIntent: () => Promise<void>;

  resetDemo: () => Promise<void>;
}

const SpontanContext = createContext<SpontanContextValue | null>(null);

export function SpontanProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DataStore | null>(null);
  const [currentPersonId, setCurrentPersonId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    repository.getSnapshot().then((next) => {
      if (!active) return;
      setDb(next);
      const savedId = readAuth();
      if (savedId && getPerson(next, savedId)) setCurrentPersonId(savedId);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const areaId = useMemo(
    () => (db ? getPerson(db, currentPersonId)?.areaId ?? null : null),
    [db, currentPersonId],
  );

  const login = useCallback((personId: string) => {
    writeAuth(personId);
    setCurrentPersonId(personId);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setCurrentPersonId(null);
  }, []);

  const joinAsNew = useCallback(
    async (newAreaId: string, name: string, favoriteTypes: ActivityType[]) => {
      const person: Person = {
        id: `person-${uid()}`,
        areaId: newAreaId,
        name: name.trim(),
        color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
        favoriteTypes,
      };
      setDb(await repository.createPerson(person));
      login(person.id);
    },
    [login],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Omit<Person, 'id' | 'areaId'>>) => {
      if (!currentPersonId) return;
      setDb(await repository.updatePerson(currentPersonId, patch));
    },
    [currentPersonId],
  );

  const createSession = useCallback(
    async (input: NewSessionInput) => {
      if (!currentPersonId || !areaId) return null;
      const session: Session = {
        id: `session-${uid()}`,
        areaId,
        hostId: currentPersonId,
        type: input.type,
        venueId: input.venueId,
        startsAt: input.startsAt.toISOString(),
        durationMin: input.durationMin,
        minPlayers: input.minPlayers,
        maxPlayers: input.maxPlayers,
        vibe: input.vibe,
        note: input.note?.trim() || null,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      setDb(await repository.createSession(session));
      return session.id;
    },
    [areaId, currentPersonId],
  );

  const updateSession = useCallback(
    async (sessionId: string, patch: Partial<NewSessionInput>) => {
      const { startsAt, note, ...rest } = patch;
      setDb(
        await repository.updateSession(sessionId, {
          ...rest,
          ...(startsAt ? { startsAt: startsAt.toISOString() } : {}),
          ...(note !== undefined ? { note: note?.trim() || null } : {}),
        }),
      );
    },
    [],
  );

  const setSessionCancelled = useCallback(async (sessionId: string, cancelled: boolean) => {
    setDb(await repository.setSessionCancelled(sessionId, cancelled));
  }, []);

  const respond = useCallback(
    async (sessionId: string, status: SignupStatus) => {
      if (!currentPersonId) return;
      setDb(await repository.setSignup(sessionId, currentPersonId, status));
    },
    [currentPersonId],
  );

  const clearResponse = useCallback(
    async (sessionId: string) => {
      if (!currentPersonId) return;
      setDb(await repository.clearSignup(sessionId, currentPersonId));
    },
    [currentPersonId],
  );

  const saveIntent = useCallback(
    async (input: NewIntentInput) => {
      if (!currentPersonId || !areaId) return;
      const days = input.days ?? INTENT_DEFAULT_DAYS;
      const expires = new Date();
      expires.setDate(expires.getDate() + days);
      expires.setHours(23, 59, 0, 0);
      const intent: Intent = {
        id: `intent-${uid()}`,
        personId: currentPersonId,
        areaId,
        types: input.types,
        weekdays: input.weekdays,
        dayparts: input.dayparts,
        note: input.note?.trim() || null,
        createdAt: new Date().toISOString(),
        expiresAt: expires.toISOString(),
      };
      setDb(await repository.saveIntent(intent));
    },
    [areaId, currentPersonId],
  );

  const clearIntent = useCallback(async () => {
    if (!currentPersonId) return;
    setDb(await repository.clearIntent(currentPersonId));
  }, [currentPersonId]);

  const resetDemo = useCallback(async () => {
    const next = await repository.reset();
    setDb(next);
    if (currentPersonId && !getPerson(next, currentPersonId)) logout();
  }, [currentPersonId, logout]);

  const value = useMemo<SpontanContextValue | null>(() => {
    if (!db) return null;
    return {
      db,
      now,
      currentPersonId,
      areaId,
      login,
      logout,
      joinAsNew,
      updateProfile,
      createSession,
      updateSession,
      setSessionCancelled,
      respond,
      clearResponse,
      saveIntent,
      clearIntent,
      resetDemo,
    };
  }, [
    db,
    now,
    currentPersonId,
    areaId,
    login,
    logout,
    joinAsNew,
    updateProfile,
    createSession,
    updateSession,
    setSessionCancelled,
    respond,
    clearResponse,
    saveIntent,
    clearIntent,
    resetDemo,
  ]);

  if (!value) return <div className="app-loading">Laddar…</div>;

  return <SpontanContext.Provider value={value}>{children}</SpontanContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSpontan(): SpontanContextValue {
  const ctx = useContext(SpontanContext);
  if (!ctx) throw new Error('useSpontan måste användas inom SpontanProvider');
  return ctx;
}

// --- Persistens av inloggning ------------------------------------------------

function readAuth(): string | null {
  try {
    return localStorage.getItem(AUTH_KEY);
  } catch {
    return null;
  }
}
function writeAuth(personId: string): void {
  try {
    localStorage.setItem(AUTH_KEY, personId);
  } catch {
    /* ignore */
  }
}
function clearAuth(): void {
  try {
    localStorage.removeItem(AUTH_KEY);
  } catch {
    /* ignore */
  }
}
