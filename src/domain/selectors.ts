import type { DataStore, Entry, Player, Task, Team, Week } from '../data/types';
import {
  buildLeaderboard,
  cellContributors,
  cellCompletionCount,
  isCellLit,
  latestContributor,
  litCells,
  personalBingoCount,
  personalScore,
  completedCount,
  teamBingoCount,
  teamThreshold,
} from './scoring';

export const getClub = (db: DataStore, clubId: string) => db.clubs.find((c) => c.id === clubId) ?? null;
export const getTeam = (db: DataStore, teamId: string | null): Team | null =>
  teamId ? db.teams.find((t) => t.id === teamId) ?? null : null;
export const getPlayer = (db: DataStore, playerId: string | null): Player | null =>
  playerId ? db.players.find((p) => p.id === playerId) ?? null : null;
export const getWeek = (db: DataStore, weekId: string | null): Week | null =>
  weekId ? db.weeks.find((w) => w.id === weekId) ?? null : null;

export const getTeamByCode = (db: DataStore, code: string): Team | null => {
  const norm = code.trim().toUpperCase();
  return db.teams.find((t) => t.joinCode.toUpperCase() === norm) ?? null;
};

/** Alla medlemmar i ett lag (spelare + coach). */
export const getTeamMembers = (db: DataStore, teamId: string): Player[] =>
  db.players.filter((p) => p.teamId === teamId);

/** Veckor i en klubb, sorterade med senaste vecka sist. */
export const getClubWeeks = (db: DataStore, clubId: string): Week[] =>
  db.weeks.filter((w) => w.clubId === clubId).sort((a, b) => a.weekNumber - b.weekNumber);

export const getActiveWeek = (db: DataStore, clubId: string): Week | null =>
  db.weeks.find((w) => w.clubId === clubId && w.status === 'active') ?? null;

/** Uppgifter för en vecka, sorterade i cell-ordning. */
export const getTasks = (db: DataStore, weekId: string): Task[] =>
  db.tasks.filter((t) => t.weekId === weekId).sort((a, b) => a.cellIndex - b.cellIndex);

export const getTask = (db: DataStore, weekId: string, cellIndex: number): Task | null =>
  db.tasks.find((t) => t.weekId === weekId && t.cellIndex === cellIndex) ?? null;

/** En spelares entries för en vecka. */
export const getPlayerEntries = (db: DataStore, weekId: string, playerId: string): Entry[] =>
  db.entries.filter((e) => e.weekId === weekId && e.playerId === playerId);

/** Alla entries för ett lags spelare under en vecka (veckan är delad på klubbnivå). */
export function getTeamWeekEntries(db: DataStore, weekId: string, teamId: string): Entry[] {
  const memberIds = new Set(getTeamMembers(db, teamId).map((p) => p.id));
  return db.entries.filter((e) => e.weekId === weekId && memberIds.has(e.playerId));
}

export const teamThresholdFor = (db: DataStore, teamId: string): number =>
  teamThreshold(getTeamMembers(db, teamId));

export interface PersonalSummary {
  entries: Entry[];
  completedCells: number;
  points: number;
  bingos: number;
}

export function getPersonalSummary(db: DataStore, weekId: string, playerId: string): PersonalSummary {
  const entries = getPlayerEntries(db, weekId, playerId);
  return {
    entries,
    completedCells: completedCount(entries),
    points: personalScore(entries),
    bingos: personalBingoCount(entries),
  };
}

export interface TeamCellInfo {
  cellIndex: number;
  count: number;
  threshold: number;
  lit: boolean;
  contributors: Array<{ player: Player; entry: Entry }>;
  latestPlayerId: string | null;
}

export function getTeamCellInfo(db: DataStore, weekId: string, teamId: string, cellIndex: number): TeamCellInfo {
  const members = getTeamMembers(db, teamId);
  const weekEntries = getTeamWeekEntries(db, weekId, teamId);
  const threshold = teamThreshold(members);
  const contributors = cellContributors(weekEntries, cellIndex)
    .map((entry) => {
      const player = members.find((p) => p.id === entry.playerId);
      return player ? { player, entry } : null;
    })
    .filter((x): x is { player: Player; entry: Entry } => x !== null);

  return {
    cellIndex,
    count: cellCompletionCount(weekEntries, members, cellIndex),
    threshold,
    lit: isCellLit(weekEntries, members, cellIndex, threshold),
    contributors,
    latestPlayerId: latestContributor(weekEntries, cellIndex),
  };
}

export interface TeamSummary {
  threshold: number;
  litCells: Set<number>;
  litCount: number;
  teamBingos: number;
  playerCount: number;
}

export function getTeamSummary(db: DataStore, weekId: string, teamId: string): TeamSummary {
  const members = getTeamMembers(db, teamId);
  const weekEntries = getTeamWeekEntries(db, weekId, teamId);
  const threshold = teamThreshold(members);
  const lit = litCells(weekEntries, members, threshold);
  return {
    threshold,
    litCells: lit,
    litCount: lit.size,
    teamBingos: teamBingoCount(weekEntries, members, threshold),
    playerCount: members.filter((p) => p.role === 'player').length,
  };
}

export function getLeaderboard(db: DataStore, weekId: string, teamId: string) {
  return buildLeaderboard(getTeamMembers(db, teamId), getTeamWeekEntries(db, weekId, teamId));
}

export function finalUnlockedFor(db: DataStore, teamId: string): boolean {
  return Boolean(db.teamSettings.find((s) => s.teamId === teamId)?.finalUnlockedAt);
}

/**
 * Får den inloggade spelaren redigera en ruta på sin egen bricka?
 * - Aktiv vecka: ja.
 * - Arkiverad vecka: nej, om inte sommarfinalen är upplåst och rutan ännu inte
 *   är tänd på lagets bricka (då får laget "göra klart" gemensamt).
 */
export function isCellEditableForPlayer(
  db: DataStore,
  week: Week,
  playerTeamId: string,
  cellIndex: number,
): boolean {
  if (week.status === 'active') return true;
  if (week.status === 'archived' && finalUnlockedFor(db, playerTeamId)) {
    const members = getTeamMembers(db, playerTeamId);
    const weekEntries = getTeamWeekEntries(db, week.id, playerTeamId);
    const threshold = teamThreshold(members);
    return !isCellLit(weekEntries, members, cellIndex, threshold);
  }
  return false;
}
