import { LEVEL_POINTS, type AdventEntry, type Player } from '../data/types';
import { teamThreshold } from './scoring';

// Ren domänlogik för adventskalendern. Allt som beror på "idag" tar emot
// datumet som argument så att reglerna går att testa utan klocka.
// Datum jämförs som lokala "YYYY-MM-DD"-strängar (sorterar lexikografiskt).

/** Antal luckor. */
export const ADVENT_DAYS = 24;

/** Bonuspoäng för att klara en lucka samma dag som den öppnas. */
export const ON_TIME_BONUS = 1;

const pad = (n: number) => String(n).padStart(2, '0');

/** Lokal datumnyckel "YYYY-MM-DD". */
export const dateKey = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Datumnyckel för en lucka (dag 1–24 december). */
export const doorDateKey = (year: number, day: number): string => `${year}-12-${pad(day)}`;

/** Sista dagen luckor kan klaras: trettondedag jul. Därefter är kalendern skrivskyddad. */
export const adventEndKey = (year: number): string => `${year + 1}-01-06`;

/** Har luckan öppnats? Alla luckor är öppna om coachen öppnat kalendern för laget. */
export function isDoorOpen(year: number, day: number, todayKey: string, allOpen = false): boolean {
  return allOpen || todayKey >= doorDateKey(year, day);
}

/** Är kalenderperioden slut (efter trettondedag jul)? */
export const isAdventOver = (year: number, todayKey: string): boolean => todayKey > adventEndKey(year);

/** Får man markera/ändra luckan idag? Öppnad lucka går att klara i efterhand, fram till trettondedagen. */
export function isDoorEditable(year: number, day: number, todayKey: string, allOpen = false): boolean {
  return isDoorOpen(year, day, todayKey, allOpen) && !isAdventOver(year, todayKey);
}

/** Dagens lucka (1–24) eller null om det inte är 1–24 december det året. */
export function todaysDoor(year: number, todayKey: string): number | null {
  if (todayKey < doorDateKey(year, 1) || todayKey > doorDateKey(year, ADVENT_DAYS)) return null;
  return Number(todayKey.slice(8, 10));
}

/** Hela dagar kvar tills luckan öppnas (0 = idag eller redan öppen). */
export function daysUntilDoor(year: number, day: number, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(year, 11, day);
  return Math.max(0, Math.round((target.getTime() - start.getTime()) / 86_400_000));
}

/** Klarades luckan samma dag som den öppnades? */
export const isOnTime = (entry: AdventEntry, year: number): boolean =>
  dateKey(new Date(entry.completedAt)) === doorDateKey(year, entry.day);

/** Poäng för en klarad lucka: nivåpoäng (1/2/3) + 1 om den klarades i tid. */
export const doorPoints = (entry: AdventEntry, year: number): number =>
  LEVEL_POINTS[entry.level] + (isOnTime(entry, year) ? ON_TIME_BONUS : 0);

export interface AdventScore {
  points: number;
  doors: number;
  onTime: number;
}

/** Sammanställning för en spelares entries. */
export function adventScore(playerEntries: readonly AdventEntry[], year: number): AdventScore {
  return {
    points: playerEntries.reduce((sum, e) => sum + doorPoints(e, year), 0),
    doors: new Set(playerEntries.map((e) => e.day)).size,
    onTime: playerEntries.filter((e) => isOnTime(e, year)).length,
  };
}

/** Antal unika spelare (inte coacher) som klarat en lucka. */
export function doorCompletionCount(
  entries: readonly AdventEntry[],
  teamPlayers: readonly Player[],
  day: number,
): number {
  const playerIds = new Set(teamPlayers.filter((p) => p.role === 'player').map((p) => p.id));
  return new Set(entries.filter((e) => e.day === day && playerIds.has(e.playerId)).map((e) => e.playerId)).size;
}

/**
 * Luckor som lyser i lagets julgran: samma tröskel som lagbrickan i
 * sommarbingon, minst hälften av lagets spelare ska ha klarat luckan.
 */
export function litDoors(entries: readonly AdventEntry[], teamPlayers: readonly Player[]): Set<number> {
  const threshold = teamThreshold(teamPlayers);
  const lit = new Set<number>();
  for (let day = 1; day <= ADVENT_DAYS; day++) {
    if (doorCompletionCount(entries, teamPlayers, day) >= threshold) lit.add(day);
  }
  return lit;
}

export interface AdventLeaderRow extends AdventScore {
  player: Player;
  rank: number;
}

/** Topplista: poäng, sedan antal luckor, sedan namn. Delad placering vid lika poäng. */
export function buildAdventLeaderboard(
  teamPlayers: readonly Player[],
  entries: readonly AdventEntry[],
  year: number,
): AdventLeaderRow[] {
  const rows: AdventLeaderRow[] = teamPlayers
    .filter((p) => p.role === 'player')
    .map((player) => ({
      player,
      ...adventScore(
        entries.filter((e) => e.playerId === player.id),
        year,
      ),
      rank: 0,
    }));

  rows.sort((a, b) => b.points - a.points || b.doors - a.doors || a.player.firstName.localeCompare(b.player.firstName));

  let lastPoints = Number.NaN;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (row.points !== lastPoints) {
      lastRank = i + 1;
      lastPoints = row.points;
    }
    row.rank = lastRank;
  });
  return rows;
}
