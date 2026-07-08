import { CELL_COUNT, FREE_CELL_INDEX } from '../data/types';

/** Brickan är 5×5. */
export const GRID_SIZE = 5;

/**
 * Alla vinstlinjer i en 5×5-bricka: 5 rader, 5 kolumner, 2 diagonaler.
 * Varje linje är en lista med cell-index (0–24).
 */
export const BINGO_LINES: number[][] = (() => {
  const lines: number[][] = [];
  // Rader
  for (let r = 0; r < GRID_SIZE; r++) {
    lines.push(Array.from({ length: GRID_SIZE }, (_, c) => r * GRID_SIZE + c));
  }
  // Kolumner
  for (let c = 0; c < GRID_SIZE; c++) {
    lines.push(Array.from({ length: GRID_SIZE }, (_, r) => r * GRID_SIZE + c));
  }
  // Diagonaler
  lines.push(Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + i));
  lines.push(Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + (GRID_SIZE - 1 - i)));
  return lines;
})();

/** Rad (0–4) för ett cell-index. */
export const rowOf = (cellIndex: number): number => Math.floor(cellIndex / GRID_SIZE);

/** Kolumn (0–4) för ett cell-index. */
export const colOf = (cellIndex: number): number => cellIndex % GRID_SIZE;

/** Är rutan FRI-rutan (mitten)? */
export const isFreeCell = (cellIndex: number): boolean => cellIndex === FREE_CELL_INDEX;

/**
 * Antal fullständiga bingolinjer givet en mängd avklarade rutor.
 * FRI-rutan förväntas redan ingå i mängden (den räknas alltid som klar).
 */
export function countCompleteLines(completed: ReadonlySet<number>): number {
  return BINGO_LINES.filter((line) => line.every((cell) => completed.has(cell))).length;
}

/**
 * Mängden rutor som ingår i minst en fullständig bingolinje – används för att
 * markera vinnande rader visuellt.
 */
export function cellsInCompleteLines(completed: ReadonlySet<number>): Set<number> {
  const result = new Set<number>();
  for (const line of BINGO_LINES) {
    if (line.every((cell) => completed.has(cell))) {
      for (const cell of line) result.add(cell);
    }
  }
  return result;
}

/** Alla cell-index i ordning (0–24). Bekvämlighet för rendering. */
export const ALL_CELLS: number[] = Array.from({ length: CELL_COUNT }, (_, i) => i);
