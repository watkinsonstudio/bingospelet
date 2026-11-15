// "Idag" för adventskalendern. Normalt den riktiga dagen, men för att kunna
// prova kalendern innan december går det att låtsas vara ett annat datum:
//   ?datum=2026-12-10   → appen beter sig som om det vore 10 december
//   ?datum=idag         → tillbaka till riktigt datum
// Valet sparas i sessionStorage så att det följer med mellan vyerna.

const KEY = 'julkalender:datum';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readOverride(): string | null {
  try {
    const param = new URLSearchParams(window.location.search).get('datum');
    if (param !== null) {
      if (DATE_RE.test(param)) sessionStorage.setItem(KEY, param);
      else sessionStorage.removeItem(KEY);
    }
    const stored = sessionStorage.getItem(KEY);
    return stored && DATE_RE.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Nuvarande tidpunkt – med simulerat datum men riktig klockslag om ?datum= används. */
export function getNow(): Date {
  const now = new Date();
  const override = typeof window === 'undefined' ? null : readOverride();
  if (!override) return now;
  const [y, m, d] = override.split('-').map(Number);
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
}

/** Är datumet simulerat (?datum=)? Visas som en liten etikett i kalendern. */
export function isSimulatedDate(): boolean {
  return typeof window !== 'undefined' && readOverride() !== null;
}
