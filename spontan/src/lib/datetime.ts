// Svensk datum- och tidsformatering. Allt är lokal tid – appen används på plats.

const TIME = new Intl.DateTimeFormat('sv-SE', { hour: '2-digit', minute: '2-digit' });
const WEEKDAY_DATE = new Intl.DateTimeFormat('sv-SE', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "18:30" */
export function formatTime(iso: string | Date): string {
  return TIME.format(toDate(iso));
}

/** "Idag", "Imorgon", "Tor 30 juli" – relativt kalenderdygn, inte 24 timmar. */
export function formatDay(iso: string | Date, now: Date = new Date()): string {
  const date = toDate(iso);
  const diff = daysBetween(now, date);
  if (diff === 0) return 'Idag';
  if (diff === 1) return 'Imorgon';
  if (diff === -1) return 'Igår';
  return capitalize(WEEKDAY_DATE.format(date));
}

/** "Idag 18:30" */
export function formatWhen(iso: string | Date, now: Date = new Date()): string {
  return `${formatDay(iso, now)} ${formatTime(iso)}`;
}

/** Sker det här idag? Avgör om en nedräkning tillför något. */
export function isToday(iso: string | Date, now: Date = new Date()): boolean {
  return daysBetween(now, toDate(iso)) === 0;
}

/** "18:30–20:00" */
export function formatSpan(iso: string | Date, durationMin: number): string {
  const start = toDate(iso);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return `${TIME.format(start)}–${TIME.format(end)}`;
}

/** "om 40 min", "om 3 tim", "om 2 dagar", "startade nyss". */
export function formatCountdown(iso: string | Date, now: Date = new Date()): string {
  const diffMin = Math.round((toDate(iso).getTime() - now.getTime()) / 60_000);
  if (diffMin < -1) return 'startade tidigare';
  if (diffMin <= 0) return 'startar nu';
  if (diffMin < 60) return `om ${diffMin} min`;
  const hours = Math.round(diffMin / 60);
  if (hours < 24) return `om ${hours} tim`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'om 1 dag' : `om ${days} dagar`;
}

/** Antal hela kalenderdygn mellan två tidpunkter (positivt = framåt). */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Värde för <input type="datetime-local"> i lokal tid. */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Tolkar ett <input type="datetime-local">-värde som lokal tid. */
export function fromLocalInput(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Nästa jämna halvtimme – bra standardvärde när man startar ett pass. */
export function nextHalfHour(now: Date = new Date()): Date {
  const date = new Date(now);
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() + (30 - (date.getMinutes() % 30)));
  return date;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
