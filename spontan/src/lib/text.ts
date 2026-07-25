// Textbyggare för sammanfattningar och delning.

import { ACTIVITY_META, DAYPART_LABELS, WEEKDAY_LABELS } from '../data/types';
import type { ActivityType, Daypart, Session, Venue } from '../data/types';
import { formatSpan, formatWhen } from './datetime';

/** "Matchspel och Teknikpass", "Allt" när inget är valt. */
export function describeTypes(types: ActivityType[]): string {
  if (types.length === 0) return 'Allt som händer';
  const labels = types.map((t) => ACTIVITY_META[t].label);
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(', ')} och ${labels[labels.length - 1]}`;
}

/** "Alla dagar" eller "Mån, Ons, Tor". */
export function describeWeekdays(weekdays: number[]): string {
  if (weekdays.length === 0) return 'Alla dagar';
  return [...weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) // måndag först
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ');
}

/** "När som helst" eller "Eftermiddag, Kväll". */
export function describeDayparts(dayparts: Daypart[]): string {
  if (dayparts.length === 0) return 'När som helst';
  return dayparts.map((d) => DAYPART_LABELS[d]).join(', ');
}

/** Färdig text att klistra in i lagchatten. */
export function inviteText(session: Session, venue: Venue | null, url: string): string {
  const meta = ACTIVITY_META[session.type];
  const lines = [
    `${meta.emoji} ${meta.label} – ${formatWhen(session.startsAt)} (${formatSpan(
      session.startsAt,
      session.durationMin,
    )})`,
    venue ? `📍 ${venue.name}` : null,
    `Vi behöver minst ${session.minPlayers} spelare.`,
    session.note,
    `Svara här: ${url}`,
  ];
  return lines.filter(Boolean).join('\n');
}

/** Kopierar text till urklipp. Faller tillbaka på ett dolt textarea-fält. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* faller igenom */
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}
