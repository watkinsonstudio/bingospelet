import { describe, expect, it } from 'vitest';
import type { AdventEntry, Player } from '../data/types';
import { buildAdventDoors } from '../data/adventSeed';
import {
  adventScore,
  buildAdventLeaderboard,
  daysUntilDoor,
  doorCompletionCount,
  isDoorEditable,
  isDoorOpen,
  isOnTime,
  litDoors,
  todaysDoor,
} from './advent';

const YEAR = 2026;
let n = 0;

/** Entry klarad lokal tid den givna dagen (månad 0-baserad, 11 = december). */
function entry(playerId: string, day: number, level: AdventEntry['level'], when = new Date(YEAR, 11, day, 18)): AdventEntry {
  return { id: `a${n++}`, calendarId: 'c', playerId, day, level, completedAt: when.toISOString() };
}
const player = (id: string, role: Player['role'] = 'player'): Player => ({ id, teamId: 't', firstName: id, color: '#000', role });

describe('luckorna', () => {
  it('har 24 luckor med tre nivåer var', () => {
    const doors = buildAdventDoors();
    expect(doors.map((d) => d.day)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    for (const d of doors) {
      expect(d.levelEasyText && d.levelMediumText && d.levelHardText).toBeTruthy();
    }
  });

  it('öppnas på sitt datum, inte före', () => {
    expect(isDoorOpen(YEAR, 7, '2026-12-06')).toBe(false);
    expect(isDoorOpen(YEAR, 7, '2026-12-07')).toBe(true);
    expect(isDoorOpen(YEAR, 7, '2026-12-20')).toBe(true);
    expect(isDoorOpen(YEAR, 1, '2026-11-15')).toBe(false);
  });

  it('kan öppnas i förväg av coachen', () => {
    expect(isDoorOpen(YEAR, 24, '2026-11-15', true)).toBe(true);
  });

  it('går att klara i efterhand fram till trettondedag jul', () => {
    expect(isDoorEditable(YEAR, 3, '2027-01-06')).toBe(true);
    expect(isDoorEditable(YEAR, 3, '2027-01-07')).toBe(false);
  });

  it('vet vilken som är dagens lucka', () => {
    expect(todaysDoor(YEAR, '2026-11-30')).toBeNull();
    expect(todaysDoor(YEAR, '2026-12-01')).toBe(1);
    expect(todaysDoor(YEAR, '2026-12-24')).toBe(24);
    expect(todaysDoor(YEAR, '2026-12-25')).toBeNull();
  });

  it('räknar dagar kvar', () => {
    expect(daysUntilDoor(YEAR, 1, new Date(2026, 10, 15, 22))).toBe(16);
    expect(daysUntilDoor(YEAR, 1, new Date(2026, 11, 1, 8))).toBe(0);
    expect(daysUntilDoor(YEAR, 1, new Date(2026, 11, 5))).toBe(0);
  });
});

describe('poäng', () => {
  it('ger nivåpoäng och +1 för lucka klarad samma dag', () => {
    const onTime = entry('a', 5, 'M');
    const late = entry('a', 6, 'S', new Date(YEAR, 11, 9, 12));
    expect(isOnTime(onTime, YEAR)).toBe(true);
    expect(isOnTime(late, YEAR)).toBe(false);
    expect(adventScore([onTime, late], YEAR)).toEqual({ points: 2 + 1 + 3, doors: 2, onTime: 1 });
  });

  it('rankar topplistan med delad placering och utan coacher', () => {
    const players = [player('Alva'), player('Bo'), player('Cia'), player('coach', 'coach')];
    const entries = [
      entry('Alva', 1, 'S'), // 4
      entry('Bo', 1, 'S'), // 4
      entry('Cia', 1, 'L', new Date(YEAR, 11, 3)), // 1
      entry('coach', 1, 'S'),
    ];
    const rows = buildAdventLeaderboard(players, entries, YEAR);
    expect(rows.map((r) => [r.player.id, r.rank, r.points])).toEqual([
      ['Alva', 1, 4],
      ['Bo', 1, 4],
      ['Cia', 3, 1],
    ]);
  });
});

describe('lagets julgran', () => {
  const players = ['a', 'b', 'c', 'd', 'e'].map((id) => player(id)).concat(player('coach', 'coach'));

  it('räknar unika spelare per lucka och ignorerar coacher', () => {
    const entries = [entry('a', 2, 'L'), entry('a', 2, 'M'), entry('b', 2, 'L'), entry('coach', 2, 'S')];
    expect(doorCompletionCount(entries, players, 2)).toBe(2);
  });

  it('tänder ett ljus när minst hälften av laget klarat luckan', () => {
    // 5 spelare → tröskel 3.
    const two = [entry('a', 4, 'L'), entry('b', 4, 'L')];
    expect(litDoors(two, players).has(4)).toBe(false);
    expect(litDoors([...two, entry('c', 4, 'S')], players).has(4)).toBe(true);
  });
});
