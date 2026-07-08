import {
  FREE_CELL_INDEX,
  LEVEL_POINTS,
  type Entry,
  type Level,
  type Player,
} from '../data/types';
import { countCompleteLines } from './board';

/** Poäng för en given nivå. */
export const pointsForLevel = (level: Level): number => LEVEL_POINTS[level];

/**
 * Mängden avklarade rutor för en spelare, baserat på spelarens entries.
 * FRI-rutan (index 12) läggs alltid till – den räknas som klar automatiskt.
 */
export function completedCells(playerEntries: readonly Entry[]): Set<number> {
  const set = new Set<number>(playerEntries.map((e) => e.cellIndex));
  set.add(FREE_CELL_INDEX);
  return set;
}

/**
 * Personlig poäng = summan av nivåernas poängvärden för alla klarade rutor.
 * FRI-rutan har ingen nivå och ger 0 poäng.
 */
export function personalScore(playerEntries: readonly Entry[]): number {
  return playerEntries.reduce((sum, e) => sum + pointsForLevel(e.level), 0);
}

/** Antal klarade rutor för en spelare (inklusive FRI-rutan). */
export function completedCount(playerEntries: readonly Entry[]): number {
  return completedCells(playerEntries).size;
}

/** Antal personliga bingos (fullständiga rader/kolumner/diagonaler). */
export function personalBingoCount(playerEntries: readonly Entry[]): number {
  return countCompleteLines(completedCells(playerEntries));
}

/**
 * Tröskeln för att en ruta ska tändas på lagbrickan: minst hälften av lagets
 * spelare, avrundat uppåt. Endast spelare med rollen 'player' räknas.
 */
export function teamThreshold(teamPlayers: readonly Player[]): number {
  const count = teamPlayers.filter((p) => p.role === 'player').length;
  return Math.max(1, Math.ceil(count / 2));
}

/** Bidragsgivare (unika spelar-id:n) till en viss ruta, sorterade i tidsordning. */
export function cellContributors(weekEntries: readonly Entry[], cellIndex: number): Entry[] {
  return weekEntries
    .filter((e) => e.cellIndex === cellIndex)
    .slice()
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

/**
 * Antal unika spelare som klarat en ruta (oavsett nivå). FRI-rutan räknas som
 * klarad av alla lagets spelare.
 */
export function cellCompletionCount(
  weekEntries: readonly Entry[],
  teamPlayers: readonly Player[],
  cellIndex: number,
): number {
  if (cellIndex === FREE_CELL_INDEX) {
    return teamPlayers.filter((p) => p.role === 'player').length;
  }
  const unique = new Set(weekEntries.filter((e) => e.cellIndex === cellIndex).map((e) => e.playerId));
  return unique.size;
}

/** Är rutan tänd på lagbrickan (tröskeln uppnådd)? */
export function isCellLit(
  weekEntries: readonly Entry[],
  teamPlayers: readonly Player[],
  cellIndex: number,
  threshold: number,
): boolean {
  if (cellIndex === FREE_CELL_INDEX) return true;
  return cellCompletionCount(weekEntries, teamPlayers, cellIndex) >= threshold;
}

/** Mängden tända rutor på lagbrickan. */
export function litCells(
  weekEntries: readonly Entry[],
  teamPlayers: readonly Player[],
  threshold: number,
): Set<number> {
  const set = new Set<number>();
  for (let cell = 0; cell < 25; cell++) {
    if (isCellLit(weekEntries, teamPlayers, cell, threshold)) set.add(cell);
  }
  return set;
}

/** Antal lagbingos (fullständiga rader av tända rutor). */
export function teamBingoCount(
  weekEntries: readonly Entry[],
  teamPlayers: readonly Player[],
  threshold: number,
): number {
  return countCompleteLines(litCells(weekEntries, teamPlayers, threshold));
}

/**
 * Vem klarade rutan senast (för guldrings-markeringen). Returnerar spelar-id
 * eller null om ingen klarat den.
 */
export function latestContributor(weekEntries: readonly Entry[], cellIndex: number): string | null {
  const contributors = cellContributors(weekEntries, cellIndex);
  return contributors.length ? contributors[contributors.length - 1].playerId : null;
}

export interface LeaderboardRow {
  player: Player;
  points: number;
  completed: number;
  bingos: number;
  rank: number;
}

/**
 * Topplista för ett lag under en vecka. Rankar efter poäng (fallande), sedan
 * antal klarade rutor. Endast spelare med rollen 'player' listas.
 */
export function buildLeaderboard(
  teamPlayers: readonly Player[],
  weekEntries: readonly Entry[],
): LeaderboardRow[] {
  const rows = teamPlayers
    .filter((p) => p.role === 'player')
    .map((player) => {
      const playerEntries = weekEntries.filter((e) => e.playerId === player.id);
      return {
        player,
        points: personalScore(playerEntries),
        completed: completedCount(playerEntries),
        bingos: personalBingoCount(playerEntries),
        rank: 0,
      };
    });

  rows.sort((a, b) => b.points - a.points || b.completed - a.completed || a.player.firstName.localeCompare(b.player.firstName));

  // Ranking med delad placering vid lika poäng.
  let lastPoints = Number.NaN;
  let lastRank = 0;
  rows.forEach((row, index) => {
    if (row.points !== lastPoints) {
      lastRank = index + 1;
      lastPoints = row.points;
    }
    row.rank = lastRank;
  });

  return rows;
}
