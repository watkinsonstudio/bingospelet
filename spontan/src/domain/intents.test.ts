import { describe, expect, it } from 'vitest';
import type { ActivityType, Daypart, Intent, Session, Signup } from '../data/types';
import {
  activeIntents,
  daypartOfDate,
  intentClusters,
  intentCovers,
  pingCandidates,
  proposedStart,
} from './intents';

// Lördag 25 juli 2026, 12:00 lokal tid.
const NOW = new Date(2026, 6, 25, 12, 0, 0);

function intent(
  personId: string,
  types: ActivityType[],
  weekdays: number[] = [],
  dayparts: Daypart[] = [],
  expiresInDays = 7,
): Intent {
  const expires = new Date(NOW);
  expires.setDate(expires.getDate() + expiresInDays);
  return {
    id: `i-${personId}`,
    personId,
    areaId: 'a1',
    types,
    weekdays,
    dayparts,
    note: null,
    createdAt: NOW.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

describe('daypartOfDate', () => {
  it('placerar klockslag i rätt del av dygnet', () => {
    expect(daypartOfDate(new Date(2026, 6, 25, 7, 0))).toBe('morgon');
    expect(daypartOfDate(new Date(2026, 6, 25, 12, 30))).toBe('lunch');
    expect(daypartOfDate(new Date(2026, 6, 25, 16, 0))).toBe('eftermiddag');
    expect(daypartOfDate(new Date(2026, 6, 25, 20, 0))).toBe('kvall');
  });

  it('räknar småtimmarna som kväll', () => {
    expect(daypartOfDate(new Date(2026, 6, 25, 2, 0))).toBe('kvall');
  });
});

describe('activeIntents', () => {
  it('filtrerar bort utgångna sugen-status', () => {
    const fresh = intent('p1', ['match'], [], [], 3);
    const stale = intent('p2', ['match'], [], [], -1);
    expect(activeIntents([fresh, stale], NOW).map((i) => i.personId)).toEqual(['p1']);
  });
});

describe('intentCovers', () => {
  const monday = new Date(2026, 6, 27, 19, 0); // måndag kväll

  it('matchar på typ, veckodag och tid på dygnet', () => {
    expect(intentCovers(intent('p1', ['match'], [1], ['kvall']), 'match', monday)).toBe(true);
  });

  it('säger nej när aktiviteten inte efterfrågats', () => {
    expect(intentCovers(intent('p1', ['teknik'], [], []), 'match', monday)).toBe(false);
  });

  it('säger nej på fel veckodag eller fel tid på dygnet', () => {
    expect(intentCovers(intent('p1', ['match'], [2], ['kvall']), 'match', monday)).toBe(false);
    expect(intentCovers(intent('p1', ['match'], [1], ['morgon']), 'match', monday)).toBe(false);
  });

  it('tolkar tomma listor som "spelar ingen roll"', () => {
    expect(intentCovers(intent('p1', ['match'], [], []), 'match', monday)).toBe(true);
  });
});

describe('intentClusters', () => {
  it('hittar överlapp och rankar de största först', () => {
    const intents = [
      intent('p1', ['match'], [], ['kvall']),
      intent('p2', ['match'], [], ['kvall']),
      intent('p3', ['match'], [], ['kvall']),
      intent('p4', ['teknik'], [], ['kvall']),
      intent('p5', ['teknik'], [], ['kvall']),
    ];
    const clusters = intentClusters(intents, NOW, { horizonDays: 1, limit: 5 });
    expect(clusters).toHaveLength(2);
    expect(clusters[0].type).toBe('match');
    expect(clusters[0].personIds).toEqual(['p1', 'p2', 'p3']);
    expect(clusters[1].type).toBe('teknik');
    expect(daypartOfDate(new Date(clusters[0].startsAt))).toBe('kvall');
  });

  it('visar bara det bästa förslaget per aktivitet – inte samma gäng varje kväll', () => {
    const intents = [intent('p1', ['match'], [], ['kvall']), intent('p2', ['match'], [], ['kvall'])];
    expect(intentClusters(intents, NOW, { horizonDays: 7 })).toHaveLength(1);
    expect(
      intentClusters(intents, NOW, { horizonDays: 7, onePerType: false, limit: 99 }).length,
    ).toBeGreaterThan(1);
  });

  it('kräver minst två sugna', () => {
    const clusters = intentClusters([intent('p1', ['match'], [], ['kvall'])], NOW, {
      horizonDays: 1,
    });
    expect(clusters).toHaveLength(0);
  });

  it('hoppar över tider som redan passerat idag', () => {
    const intents = [intent('p1', ['match'], [], ['morgon']), intent('p2', ['match'], [], ['morgon'])];
    // Klockan är 12 – morgonpasset idag är förbi, men imorgon bitti går bra.
    expect(intentClusters(intents, NOW, { horizonDays: 1 })).toHaveLength(0);
    expect(intentClusters(intents, NOW, { horizonDays: 2 })).toHaveLength(1);
  });

  it('föreslår inte tider efter att sugen-statusen gått ut', () => {
    const intents = [
      intent('p1', ['match'], [], ['kvall'], 1),
      intent('p2', ['match'], [], ['kvall'], 1),
    ];
    const clusters = intentClusters(intents, NOW, { horizonDays: 7 });
    expect(clusters).toHaveLength(1);
    expect(new Date(clusters[0].startsAt).getDate()).toBe(25);
  });

  it('föreslår en starttid inom rätt del av dygnet', () => {
    const start = proposedStart(NOW, 2, 'eftermiddag');
    expect(start.getDate()).toBe(27);
    expect(start.getHours()).toBe(16);
  });
});

describe('pingCandidates', () => {
  const session: Session = {
    id: 's1',
    areaId: 'a1',
    hostId: 'p1',
    type: 'match',
    venueId: 'v1',
    startsAt: new Date(2026, 6, 27, 19, 0).toISOString(), // måndag kväll
    durationMin: 90,
    minPlayers: 8,
    maxPlayers: null,
    vibe: 'alla',
    note: null,
    status: 'open',
    createdAt: NOW.toISOString(),
  };

  const signups: Signup[] = [
    { id: 'sg1', sessionId: 's1', personId: 'p2', status: 'ja', createdAt: NOW.toISOString() },
    { id: 'sg2', sessionId: 's1', personId: 'p3', status: 'nej', createdAt: NOW.toISOString() },
  ];

  it('föreslår sugna som varken är värd eller redan svarat', () => {
    const intents = [
      intent('p1', ['match'], [], ['kvall']), // värden
      intent('p2', ['match'], [], ['kvall']), // har svarat ja
      intent('p3', ['match'], [], ['kvall']), // har svarat nej
      intent('p4', ['match'], [], ['kvall']), // har inte sett passet
      intent('p5', ['kondition'], [], ['kvall']), // vill göra något annat
    ];
    expect(pingCandidates(intents, session, signups, NOW)).toEqual(['p4']);
  });
});
