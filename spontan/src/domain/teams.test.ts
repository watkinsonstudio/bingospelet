import { describe, expect, it } from 'vitest';
import { splitTeams } from './teams';

const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

describe('splitTeams', () => {
  it('får med alla spelare exakt en gång', () => {
    const teams = splitTeams(players, 'session-1');
    const all = teams.flatMap((t) => t.memberIds).sort();
    expect(all).toEqual([...players].sort());
  });

  it('delar så jämnt som möjligt vid udda antal', () => {
    const [a, b] = splitTeams(players, 'session-1');
    expect(Math.abs(a.memberIds.length - b.memberIds.length)).toBeLessThanOrEqual(1);
  });

  it('ger samma lag för samma frö – alla telefoner visar samma sak', () => {
    expect(splitTeams(players, 'session-1')).toEqual(splitTeams(players, 'session-1'));
  });

  it('ger en ny lottning när fröet ändras', () => {
    const first = splitTeams(players, 'session-1:0');
    const second = splitTeams(players, 'session-1:1');
    expect(first).not.toEqual(second);
  });

  it('bryr sig inte om vilken ordning spelarna kom in', () => {
    const reversed = [...players].reverse();
    expect(splitTeams(reversed, 'session-1')).toEqual(splitTeams(players, 'session-1'));
  });

  it('klarar tre lag', () => {
    const teams = splitTeams(players, 'session-1', 3);
    expect(teams).toHaveLength(3);
    expect(teams.flatMap((t) => t.memberIds)).toHaveLength(players.length);
    expect(Math.max(...teams.map((t) => t.memberIds.length))).toBeLessThanOrEqual(3);
  });
});
