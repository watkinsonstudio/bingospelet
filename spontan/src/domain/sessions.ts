// Ren domänlogik för pass: vem är med, blir det av, är det fullt, har det varit?
// Inga React-beroenden och ingen datumformatering – bara regler, testade i
// sessions.test.ts. Klockan skickas alltid in (`now`) så att logiken går att testa.

import type { Session, Signup } from '../data/types';

/** Läge som räknas fram ur klockan + det lagrade status-fältet. */
export type Phase = 'kommande' | 'pagar' | 'avslutat' | 'instalt';

export interface SessionState {
  phase: Phase;
  /** Personer med "ja" som får plats, i anmälningsordning. */
  going: string[];
  /** "Ja" utöver maxPlayers – reserver, i kö-ordning. */
  waitlist: string[];
  maybe: string[];
  declined: string[];
  goingCount: number;
  maybeCount: number;
  /** Hur många fler "ja" som krävs för att passet ska bli av. 0 = klart. */
  needed: number;
  /** Platser kvar innan taket. null = inget tak. */
  spotsLeft: number | null;
  isFull: boolean;
  /** minPlayers uppnått – passet blir av. */
  isConfirmed: boolean;
  startsAtMs: number;
  endsAtMs: number;
}

/** Sluttid i millisekunder (start + längd). */
export function endsAtMs(session: Session): number {
  return new Date(session.startsAt).getTime() + session.durationMin * 60_000;
}

/** Anmälningar för ett visst pass, i anmälningsordning (äldst först). */
export function signupsFor(signups: Signup[], sessionId: string): Signup[] {
  return signups
    .filter((s) => s.sessionId === sessionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** En persons svar på ett pass, eller null om hen inte svarat. */
export function signupOf(signups: Signup[], sessionId: string, personId: string): Signup | null {
  return signups.find((s) => s.sessionId === sessionId && s.personId === personId) ?? null;
}

/**
 * Räknar fram allt UI:t behöver veta om ett pass.
 *
 * Regler:
 * - "Ja" fördelas i anmälningsordning; de som inte får plats blir reserver.
 * - Passet är klart när antalet "ja" (med plats) når minPlayers.
 * - Inställda pass är alltid `instalt`, oavsett klockan.
 */
export function sessionState(session: Session, signups: Signup[], now: Date): SessionState {
  const ordered = signupsFor(signups, session.id);
  const yes = ordered.filter((s) => s.status === 'ja').map((s) => s.personId);
  const cap = session.maxPlayers;

  const going = cap === null ? yes : yes.slice(0, cap);
  const waitlist = cap === null ? [] : yes.slice(cap);
  const maybe = ordered.filter((s) => s.status === 'kanske').map((s) => s.personId);
  const declined = ordered.filter((s) => s.status === 'nej').map((s) => s.personId);

  const startsAt = new Date(session.startsAt).getTime();
  const endsAt = endsAtMs(session);
  const t = now.getTime();

  let phase: Phase;
  if (session.status === 'cancelled') phase = 'instalt';
  else if (t >= endsAt) phase = 'avslutat';
  else if (t >= startsAt) phase = 'pagar';
  else phase = 'kommande';

  return {
    phase,
    going,
    waitlist,
    maybe,
    declined,
    goingCount: going.length,
    maybeCount: maybe.length,
    needed: Math.max(0, session.minPlayers - going.length),
    spotsLeft: cap === null ? null : Math.max(0, cap - going.length),
    isFull: cap !== null && going.length >= cap,
    isConfirmed: going.length >= session.minPlayers,
    startsAtMs: startsAt,
    endsAtMs: endsAt,
  };
}

/** Kort statusrad: det första man vill veta när man skummar flödet. */
export function statusLabel(state: SessionState): string {
  switch (state.phase) {
    case 'instalt':
      return 'Inställt';
    case 'avslutat':
      return 'Avslutat';
    case 'pagar':
      return 'Pågår nu';
    default:
      break;
  }
  if (state.needed > 0) {
    return state.needed === 1 ? 'Behöver 1 till' : `Behöver ${state.needed} till`;
  }
  if (state.isFull) return 'Fullt – reservplats kvar';
  return `Blir av – ${state.goingCount} anmälda`;
}

/** Pass som ännu inte är slut, sorterade med det som händer först överst. */
export function upcomingSessions(sessions: Session[], now: Date, includeCancelled = true): Session[] {
  const t = now.getTime();
  return sessions
    .filter((s) => endsAtMs(s) > t)
    .filter((s) => includeCancelled || s.status !== 'cancelled')
    .sort(bySoonest);
}

/** Avslutade pass, senast först. */
export function pastSessions(sessions: Session[], now: Date): Session[] {
  const t = now.getTime();
  return sessions.filter((s) => endsAtMs(s) <= t).sort((a, b) => -bySoonest(a, b));
}

/** Pass där personen är värd eller har svarat "ja"/"kanske". */
export function sessionsForPerson(
  sessions: Session[],
  signups: Signup[],
  personId: string,
): Session[] {
  const answered = new Set(
    signups
      .filter((s) => s.personId === personId && s.status !== 'nej')
      .map((s) => s.sessionId),
  );
  return sessions.filter((s) => s.hostId === personId || answered.has(s.id)).sort(bySoonest);
}

function bySoonest(a: Session, b: Session): number {
  return a.startsAt.localeCompare(b.startsAt) || a.createdAt.localeCompare(b.createdAt);
}
