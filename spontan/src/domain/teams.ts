// Lagindelning på plan. Två knapptryck ska räcka: appen delar upp de som är på
// plats i jämna lag, deterministiskt utifrån ett frö (passets id + antal
// omblandningar) så att alla telefoner visar samma lag.

/** Ett uppdelat lag med namn och västfärg. */
export interface SplitTeam {
  name: string;
  color: string;
  memberIds: string[];
}

const TEAM_PRESETS = [
  { name: 'Västar', color: '#c97d1f' },
  { name: 'Utan västar', color: '#2563a8' },
  { name: 'Tredje laget', color: '#1f7a4d' },
];

/**
 * Delar personerna i `teamCount` lag så jämnt som möjligt.
 *
 * Ordningen blandas med en enkel deterministisk hash av fröet – samma frö ger
 * alltid samma lag, olika frön ger en ny lottning. Spelarna delas ut varvat
 * (orm-ordning) så att lagen får lika många även vid udda antal.
 */
export function splitTeams(personIds: string[], seed: string, teamCount = 2): SplitTeam[] {
  const count = Math.max(2, Math.min(teamCount, TEAM_PRESETS.length));
  const shuffled = shuffle(personIds, seed);
  const teams: SplitTeam[] = TEAM_PRESETS.slice(0, count).map((preset) => ({
    ...preset,
    memberIds: [],
  }));

  // Orm-ordning: 0,1,2,2,1,0,0,1,2 … ger jämnast fördelning även vid udda antal.
  shuffled.forEach((personId, i) => {
    const round = Math.floor(i / count);
    const slot = i % count;
    const index = round % 2 === 0 ? slot : count - 1 - slot;
    teams[index].memberIds.push(personId);
  });

  return teams;
}

/** Deterministisk blandning: sorterar på en hash av frö + element. */
export function shuffle<T extends string>(items: T[], seed: string): T[] {
  return [...items]
    .map((value) => ({ value, key: hash(`${seed}:${value}`) }))
    .sort((a, b) => a.key - b.key || a.value.localeCompare(b.value))
    .map(({ value }) => value);
}

/** FNV-1a – liten, stabil och helt tillräcklig för lottning av lag. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
