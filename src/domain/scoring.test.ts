import { describe, expect, it } from 'vitest';
import type { Entry, Player } from '../data/types';
import {
  buildLeaderboard,
  cellCompletionCount,
  completedCount,
  isCellLit,
  litCells,
  personalBingoCount,
  personalScore,
  teamBingoCount,
  teamThreshold,
} from './scoring';
import { BINGO_LINES, countCompleteLines } from './board';

let entryId = 0;
function entry(playerId: string, cellIndex: number, level: Entry['level'], minute = 0): Entry {
  return {
    id: `e${entryId++}`,
    weekId: 'w1',
    playerId,
    cellIndex,
    level,
    completedAt: `2026-07-06T10:${String(minute).padStart(2, '0')}:00.000Z`,
  };
}

function player(id: string, role: Player['role'] = 'player'): Player {
  return { id, teamId: 't1', firstName: id, color: '#000', role };
}

describe('board', () => {
  it('har 12 vinstlinjer (5 rader, 5 kolumner, 2 diagonaler)', () => {
    expect(BINGO_LINES).toHaveLength(12);
    for (const line of BINGO_LINES) expect(line).toHaveLength(5);
  });

  it('räknar en fullständig rad som en linje', () => {
    const done = new Set([0, 1, 2, 3, 4]);
    expect(countCompleteLines(done)).toBe(1);
  });

  it('räknar diagonal + mitten korrekt', () => {
    expect(countCompleteLines(new Set([0, 6, 12, 18, 24]))).toBe(1);
    expect(countCompleteLines(new Set([4, 8, 12, 16, 20]))).toBe(1);
  });
});

describe('personlig poäng och bingo', () => {
  it('summerar nivåpoäng (L=1, M=2, S=3), FRI ger 0', () => {
    const entries = [entry('p1', 0, 'S'), entry('p1', 1, 'M'), entry('p1', 2, 'L')];
    expect(personalScore(entries)).toBe(6);
  });

  it('räknar FRI-rutan som klar utan entry', () => {
    // Endast entries för 10,11,13,14 – mitten (12) ska ändå ge en mittradsbingo.
    const entries = [
      entry('p1', 10, 'L'),
      entry('p1', 11, 'L'),
      entry('p1', 13, 'L'),
      entry('p1', 14, 'L'),
    ];
    expect(personalBingoCount(entries)).toBe(1);
    // 4 entries + FRI = 5 klarade rutor.
    expect(completedCount(entries)).toBe(5);
  });

  it('ger två bingos när både rad och diagonal är klara', () => {
    const entries = [
      entry('p1', 0, 'S'),
      entry('p1', 1, 'M'),
      entry('p1', 2, 'M'),
      entry('p1', 3, 'S'),
      entry('p1', 4, 'M'),
      entry('p1', 6, 'M'),
      entry('p1', 18, 'S'),
      entry('p1', 24, 'L'),
    ];
    // Rad 0 (0-4) + diagonal (0,6,12,18,24, där 12 är FRI) = 2 bingos.
    expect(personalBingoCount(entries)).toBe(2);
  });
});

describe('lagbricka och tröskel', () => {
  const players = [player('a'), player('b'), player('c'), player('d'), player('e'), player('f'), player('g'), player('h')];

  it('tröskel = ceil(antal spelare / 2)', () => {
    expect(teamThreshold(players)).toBe(4); // 8 spelare → 4
    expect(teamThreshold(players.slice(0, 7))).toBe(4); // 7 → 4
    expect(teamThreshold(players.slice(0, 1))).toBe(1);
  });

  it('coacher räknas inte in i tröskeln', () => {
    const withCoach = [...players, player('coach', 'coach')];
    expect(teamThreshold(withCoach)).toBe(4); // fortfarande 8 spelare
  });

  it('räknar unika bidragsgivare per ruta oavsett nivå', () => {
    const entries = [entry('a', 5, 'L'), entry('b', 5, 'S'), entry('c', 5, 'M'), entry('a', 5, 'M', 5)];
    // 'a' dubbelt räknas bara en gång.
    expect(cellCompletionCount(entries, players, 5)).toBe(3);
  });

  it('tänder rutan först när tröskeln nås', () => {
    const threshold = teamThreshold(players); // 4
    const three = [entry('a', 5, 'L'), entry('b', 5, 'L'), entry('c', 5, 'L')];
    expect(isCellLit(three, players, 5, threshold)).toBe(false);
    const four = [...three, entry('d', 5, 'L')];
    expect(isCellLit(four, players, 5, threshold)).toBe(true);
  });

  it('FRI-rutan är alltid tänd på lagbrickan', () => {
    expect(isCellLit([], players, 12, teamThreshold(players))).toBe(true);
    expect(litCells([], players, teamThreshold(players)).has(12)).toBe(true);
  });

  it('räknar lagbingo när en hel rad är tänd', () => {
    const threshold = teamThreshold(players); // 4
    const litRow: Entry[] = [];
    // Tänd cell 0,1,2,3,4 (rad 0) genom att 4 spelare klarar var och en.
    for (const cell of [0, 1, 2, 3, 4]) {
      for (const p of ['a', 'b', 'c', 'd']) litRow.push(entry(p, cell, 'L'));
    }
    expect(teamBingoCount(litRow, players, threshold)).toBe(1);
  });
});

describe('topplista', () => {
  const players = [player('Alva'), player('Bo'), player('Cia'), player('coach', 'coach')];

  it('rankar efter poäng och utelämnar coacher', () => {
    const entries = [
      entry('Alva', 0, 'S'),
      entry('Alva', 1, 'S'), // 6p
      entry('Bo', 0, 'L'), // 1p
      entry('Cia', 0, 'M'),
      entry('Cia', 1, 'M'), // 4p
      entry('coach', 0, 'S'), // ska ignoreras
    ];
    const board = buildLeaderboard(players, entries);
    expect(board.map((r) => r.player.id)).toEqual(['Alva', 'Cia', 'Bo']);
    expect(board[0].rank).toBe(1);
    expect(board[0].points).toBe(6);
  });

  it('ger delad placering vid lika poäng', () => {
    const entries = [entry('Alva', 0, 'M'), entry('Bo', 0, 'M')];
    const board = buildLeaderboard(players.slice(0, 3), entries);
    expect(board[0].rank).toBe(1);
    expect(board[1].rank).toBe(1);
    expect(board[2].rank).toBe(3);
  });
});
