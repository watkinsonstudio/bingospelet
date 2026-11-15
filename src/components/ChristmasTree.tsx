import { ADVENT_DAYS } from '../domain/advent';

// Lagets julgran: ett ljus per lucka. Ljuset tänds när minst hälften av laget
// klarat luckan (samma tröskel som lagbrickan). Stjärnan tänds när alla lyser.

const CX = 110;
// [y, antal ljus, trädets halva bredd vid y]
const ROWS: Array<[number, number, number]> = [
  [62, 2, 23],
  [95, 4, 46],
  [132, 5, 55],
  [170, 6, 58],
  [199, 7, 84],
];
const COLORS = ['var(--tree-red)', 'var(--tree-gold)', 'var(--tree-white)'];

const BULBS: Array<{ day: number; x: number; y: number }> = (() => {
  const out: Array<{ day: number; x: number; y: number }> = [];
  let day = 1;
  for (const [y, count, hw] of ROWS) {
    const spread = hw * 0.78;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? CX : CX - spread + (2 * spread * i) / (count - 1);
      out.push({ day: day++, x, y: y + (i % 2 === 0 ? 0 : 3) });
    }
  }
  return out;
})();

export function ChristmasTree({ lit }: { lit: ReadonlySet<number> }) {
  const allLit = lit.size >= ADVENT_DAYS;
  return (
    <svg
      className="tree"
      viewBox="0 0 220 250"
      role="img"
      aria-label={`Lagets julgran: ${lit.size} av ${ADVENT_DAYS} ljus tända`}
    >
      <rect x="97" y="205" width="26" height="28" rx="3" className="tree__trunk" />
      <polygon points="110,104 18,208 202,208" className="tree__tier" />
      <polygon points="110,64 38,152 182,152" className="tree__tier" />
      <polygon points="110,30 58,102 162,102" className="tree__tier" />
      {/* Girlanger */}
      {ROWS.map(([y, , hw], i) => (
        <path
          key={i}
          d={`M${CX - hw * 0.86} ${y - 6} Q${CX} ${y + 14} ${CX + hw * 0.86} ${y - 6}`}
          className="tree__garland"
        />
      ))}
      {BULBS.map(({ day, x, y }) => {
        const on = lit.has(day);
        return (
          <circle
            key={day}
            cx={x}
            cy={y}
            r={7}
            className={`tree__bulb${on ? ' tree__bulb--lit' : ''}`}
            style={on ? { fill: COLORS[day % COLORS.length], animationDelay: `${(day % 6) * 0.35}s` } : undefined}
          >
            <title>{`Lucka ${day}${on ? ' – tänd' : ''}`}</title>
          </circle>
        );
      })}
      <path
        d="M110 8l4.4 9 9.9 1.4-7.2 7 1.7 9.8-8.8-4.6-8.8 4.6 1.7-9.8-7.2-7 9.9-1.4z"
        className={`tree__star${allLit ? ' tree__star--lit' : ''}`}
      />
    </svg>
  );
}
