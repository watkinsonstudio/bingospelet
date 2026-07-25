import { describe, expect, it } from 'vitest';
import type { Session, Signup, SignupStatus } from '../data/types';
import {
  endsAtMs,
  pastSessions,
  sessionState,
  sessionsForPerson,
  signupOf,
  statusLabel,
  upcomingSessions,
} from './sessions';

const NOW = new Date('2026-07-25T12:00:00.000Z');

function session(patch: Partial<Session> = {}): Session {
  return {
    id: 's1',
    areaId: 'a1',
    hostId: 'p1',
    type: 'match',
    venueId: 'v1',
    startsAt: '2026-07-25T16:00:00.000Z',
    durationMin: 90,
    minPlayers: 4,
    maxPlayers: null,
    vibe: 'alla',
    note: null,
    status: 'open',
    createdAt: '2026-07-24T10:00:00.000Z',
    ...patch,
  };
}

let counter = 0;
function signup(personId: string, status: SignupStatus, sessionId = 's1'): Signup {
  counter += 1;
  return {
    id: `sg${counter}`,
    sessionId,
    personId,
    status,
    // Anmälningsordningen styrs av createdAt – stigande i den ordning de skapas.
    createdAt: `2026-07-24T${String(10 + counter).padStart(2, '0')}:00:00.000Z`,
  };
}

describe('sessionState', () => {
  it('räknar hur många som saknas för att passet ska bli av', () => {
    const state = sessionState(session(), [signup('p1', 'ja'), signup('p2', 'ja')], NOW);
    expect(state.goingCount).toBe(2);
    expect(state.needed).toBe(2);
    expect(state.isConfirmed).toBe(false);
    expect(statusLabel(state)).toBe('Behöver 2 till');
  });

  it('är klart när minsta antalet är uppnått', () => {
    const signups = ['p1', 'p2', 'p3', 'p4'].map((id) => signup(id, 'ja'));
    const state = sessionState(session(), signups, NOW);
    expect(state.needed).toBe(0);
    expect(state.isConfirmed).toBe(true);
    expect(statusLabel(state)).toBe('Blir av – 4 anmälda');
  });

  it('lägger anmälningar utöver taket på reservplats, i anmälningsordning', () => {
    const signups = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id) => signup(id, 'ja'));
    const state = sessionState(session({ maxPlayers: 3 }), signups, NOW);
    expect(state.going).toEqual(['p1', 'p2', 'p3']);
    expect(state.waitlist).toEqual(['p4', 'p5']);
    expect(state.isFull).toBe(true);
    expect(state.spotsLeft).toBe(0);
    // Reserver räknas inte in i "blir av"-tröskeln.
    expect(state.needed).toBe(1);
  });

  it('skiljer på kanske och nej', () => {
    const state = sessionState(
      session(),
      [signup('p1', 'ja'), signup('p2', 'kanske'), signup('p3', 'nej')],
      NOW,
    );
    expect(state.going).toEqual(['p1']);
    expect(state.maybe).toEqual(['p2']);
    expect(state.declined).toEqual(['p3']);
  });

  it('byter läge när klockan passerar start och slut', () => {
    const s = session();
    expect(sessionState(s, [], new Date('2026-07-25T15:59:00.000Z')).phase).toBe('kommande');
    expect(sessionState(s, [], new Date('2026-07-25T16:30:00.000Z')).phase).toBe('pagar');
    expect(sessionState(s, [], new Date('2026-07-25T17:31:00.000Z')).phase).toBe('avslutat');
  });

  it('låter inställt gå före klockan', () => {
    const state = sessionState(session({ status: 'cancelled' }), [], NOW);
    expect(state.phase).toBe('instalt');
    expect(statusLabel(state)).toBe('Inställt');
  });

  it('räknar sluttid ur längden', () => {
    expect(endsAtMs(session())).toBe(new Date('2026-07-25T17:30:00.000Z').getTime());
  });
});

describe('listor', () => {
  const soon = session({ id: 'soon', startsAt: '2026-07-25T18:00:00.000Z' });
  const later = session({ id: 'later', startsAt: '2026-07-27T18:00:00.000Z' });
  const done = session({ id: 'done', startsAt: '2026-07-24T18:00:00.000Z' });
  const all = [later, done, soon];

  it('sorterar kommande pass med det som händer först överst', () => {
    expect(upcomingSessions(all, NOW).map((s) => s.id)).toEqual(['soon', 'later']);
  });

  it('lägger avslutade pass för sig, senast först', () => {
    expect(pastSessions(all, NOW).map((s) => s.id)).toEqual(['done']);
  });

  it('hittar personens pass – både värdskap och svar, men inte nej', () => {
    const signups = [
      signup('p9', 'ja', 'soon'),
      signup('p9', 'nej', 'later'),
      signup('p8', 'kanske', 'later'),
    ];
    expect(sessionsForPerson(all, signups, 'p9').map((s) => s.id)).toEqual(['soon']);
    // Värden räknas alltid med, även utan svar.
    expect(sessionsForPerson(all, signups, 'p1').map((s) => s.id)).toEqual(['done', 'soon', 'later']);
    expect(sessionsForPerson(all, signups, 'p8').map((s) => s.id)).toEqual(['later']);
  });

  it('hittar en persons svar på ett pass', () => {
    const signups = [signup('p1', 'kanske')];
    expect(signupOf(signups, 's1', 'p1')?.status).toBe('kanske');
    expect(signupOf(signups, 's1', 'p2')).toBeNull();
  });
});
