import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { repository } from '../data/repository';
import type { DataStore, Level, Task, Week } from '../data/types';
import { FREE_CELL_INDEX } from '../data/types';
import { getActiveWeek, getClubWeeks, getPlayer } from '../domain/selectors';

const AUTH_KEY = 'sommarbingo:auth';
export const CLUB_ID = 'club-skultuna';

interface BingoContextValue {
  loading: boolean;
  db: DataStore;

  // Aktuellt läge
  currentPlayerId: string | null;
  selectedTeamId: string | null;
  selectedWeekId: string | null;
  isCoach: boolean;

  // Åtgärder
  login: (playerId: string) => void;
  logout: () => void;
  selectTeam: (teamId: string) => void;
  selectWeek: (weekId: string) => void;
  completeCell: (cellIndex: number, level: Level) => Promise<void>;
  clearCell: (cellIndex: number) => Promise<void>;
  archiveWeek: (weekId: string) => Promise<void>;
  createNextWeek: (theme: string) => Promise<void>;
  updateTask: (taskId: string, patch: Partial<Omit<Task, 'id' | 'weekId' | 'cellIndex'>>) => Promise<void>;
  setFinalUnlocked: (teamId: string, unlocked: boolean) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const BingoContext = createContext<BingoContextValue | null>(null);

export function BingoProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DataStore | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);

  // Ladda datalager + ev. sparad inloggning vid start.
  useEffect(() => {
    let active = true;
    repository.getSnapshot().then((snapshot) => {
      if (!active) return;
      setDb(snapshot);
      const savedPlayerId = readAuth();
      const player = savedPlayerId ? getPlayer(snapshot, savedPlayerId) : null;
      if (player) {
        setCurrentPlayerId(player.id);
        setSelectedTeamId(player.teamId);
        setSelectedWeekId(getActiveWeek(snapshot, CLUB_ID)?.id ?? null);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const isCoach = useMemo(() => {
    if (!db || !currentPlayerId) return false;
    return getPlayer(db, currentPlayerId)?.role === 'coach';
  }, [db, currentPlayerId]);

  const login = useCallback(
    (playerId: string) => {
      if (!db) return;
      const player = getPlayer(db, playerId);
      if (!player) return;
      writeAuth(player.id);
      setCurrentPlayerId(player.id);
      setSelectedTeamId(player.teamId);
      setSelectedWeekId(getActiveWeek(db, CLUB_ID)?.id ?? null);
    },
    [db],
  );

  const logout = useCallback(() => {
    clearAuth();
    setCurrentPlayerId(null);
    setSelectedTeamId(null);
    setSelectedWeekId(null);
  }, []);

  const selectTeam = useCallback((teamId: string) => setSelectedTeamId(teamId), []);
  const selectWeek = useCallback((weekId: string) => setSelectedWeekId(weekId), []);

  const completeCell = useCallback(
    async (cellIndex: number, level: Level) => {
      if (!db || !currentPlayerId || !selectedWeekId || cellIndex === FREE_CELL_INDEX) return;
      setDb(await repository.completeCell(selectedWeekId, currentPlayerId, cellIndex, level));
    },
    [db, currentPlayerId, selectedWeekId],
  );

  const clearCell = useCallback(
    async (cellIndex: number) => {
      if (!db || !currentPlayerId || !selectedWeekId) return;
      setDb(await repository.clearCell(selectedWeekId, currentPlayerId, cellIndex));
    },
    [db, currentPlayerId, selectedWeekId],
  );

  const archiveWeek = useCallback(async (weekId: string) => {
    setDb(await repository.setWeekStatus(weekId, 'archived'));
  }, []);

  const createNextWeek = useCallback(
    async (theme: string) => {
      if (!db) return;
      const weeks = getClubWeeks(db, CLUB_ID);
      const nextNumber = weeks.reduce((max, w) => Math.max(max, w.weekNumber), 0) + 1;
      const weekId = `week-${crypto.randomUUID()}`;
      const week: Week = {
        id: weekId,
        teamId: null,
        clubId: CLUB_ID,
        weekNumber: nextNumber,
        theme: theme.trim() || `Vecka ${nextNumber}`,
        dateRange: '',
        status: 'active',
      };
      const tasks: Task[] = Array.from({ length: 25 }, (_, cellIndex) => ({
        id: `${weekId}-t${cellIndex}`,
        weekId,
        cellIndex,
        title: cellIndex === FREE_CELL_INDEX ? 'FRI RUTA' : `Ruta ${cellIndex + 1}`,
        levelEasyText: null,
        levelMediumText: null,
        levelHardText: null,
        animationUrl: null,
      }));
      const next = await repository.createWeek(week, tasks);
      setDb(next);
      setSelectedWeekId(weekId);
    },
    [db],
  );

  const updateTask = useCallback(
    async (taskId: string, patch: Partial<Omit<Task, 'id' | 'weekId' | 'cellIndex'>>) => {
      setDb(await repository.updateTask(taskId, patch));
    },
    [],
  );

  const setFinalUnlocked = useCallback(async (teamId: string, unlocked: boolean) => {
    setDb(await repository.setFinalUnlocked(teamId, unlocked));
  }, []);

  const resetDemo = useCallback(async () => {
    const next = await repository.reset();
    setDb(next);
    // Behåll inloggningen om spelaren fortfarande finns.
    if (currentPlayerId && !getPlayer(next, currentPlayerId)) logout();
    else setSelectedWeekId(getActiveWeek(next, CLUB_ID)?.id ?? null);
  }, [currentPlayerId, logout]);

  const value = useMemo<BingoContextValue | null>(() => {
    if (!db) return null;
    // Säkerställ giltig lagvald/veckovald för valda vyer.
    const teamId = selectedTeamId ?? getPlayer(db, currentPlayerId)?.teamId ?? null;
    const weekId = selectedWeekId ?? getActiveWeek(db, CLUB_ID)?.id ?? null;
    return {
      loading: false,
      db,
      currentPlayerId,
      selectedTeamId: teamId,
      selectedWeekId: weekId,
      isCoach,
      login,
      logout,
      selectTeam,
      selectWeek,
      completeCell,
      clearCell,
      archiveWeek,
      createNextWeek,
      updateTask,
      setFinalUnlocked,
      resetDemo,
    };
  }, [
    db,
    currentPlayerId,
    selectedTeamId,
    selectedWeekId,
    isCoach,
    login,
    logout,
    selectTeam,
    selectWeek,
    completeCell,
    clearCell,
    archiveWeek,
    createNextWeek,
    updateTask,
    setFinalUnlocked,
    resetDemo,
  ]);

  if (!value) {
    return <div className="app-loading">Laddar…</div>;
  }

  return <BingoContext.Provider value={value}>{children}</BingoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBingo(): BingoContextValue {
  const ctx = useContext(BingoContext);
  if (!ctx) throw new Error('useBingo måste användas inom BingoProvider');
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
function writeAuth(playerId: string): void {
  try {
    localStorage.setItem(AUTH_KEY, playerId);
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
