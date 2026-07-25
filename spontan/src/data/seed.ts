// Demodata. Tiderna räknas ut relativt "nu" så att flödet alltid ser levande ut
// när man öppnar appen – oavsett vilken dag utkastet visas.

import { INTENT_DEFAULT_DAYS } from './types';
import type { DataStore, Intent, Person, Session, Signup, Venue } from './types';

export const SEED_VERSION = 1;

const AREA_ID = 'area-skultuna';

/** Tidpunkt om `hours` timmar, avrundat uppåt till närmaste halvtimme. */
function soon(hours: number): Date {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + ((30 - (date.getMinutes() % 30)) % 30));
  return date;
}

/** Klockslag på en viss dag framåt/bakåt. */
function atDay(dayOffset: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function iso(date: Date): string {
  return date.toISOString();
}

const PEOPLE: Array<[string, string, string, Person['favoriteTypes']]> = [
  ['person-milo', 'Milo', '#1f7a4d', ['match', 'spontan']],
  ['person-ada', 'Ada', '#c1121f', ['match', 'teknik']],
  ['person-nils', 'Nils', '#2563a8', ['match', 'kondition']],
  ['person-vera', 'Vera', '#c97d1f', ['spontan', 'teknik']],
  ['person-jonas', 'Jonas', '#7b3fa0', ['match']],
  ['person-sara', 'Sara', '#0e7c86', ['kondition', 'match']],
  ['person-eddie', 'Eddie', '#a8452b', ['malvakt', 'spontan']],
  ['person-tuva', 'Tuva', '#4a6d1f', ['match', 'spontan']],
  ['person-hugo', 'Hugo', '#8f0c16', ['teknik', 'match']],
  ['person-lova', 'Lova', '#2f7d4f', ['match', 'kondition']],
];

const VENUES: Venue[] = [
  {
    id: 'venue-ip',
    areaId: AREA_ID,
    name: 'Skultuna IP – A-planen',
    surface: 'konstgras',
    note: 'Grinden mot parkeringen är öppen till 22. Belysning finns.',
  },
  {
    id: 'venue-grus',
    areaId: AREA_ID,
    name: 'Grusplanen vid skolan',
    surface: 'grus',
    note: 'Alltid ledig. Ta med egna västar.',
  },
  {
    id: 'venue-ang',
    areaId: AREA_ID,
    name: 'Ängsplanen',
    surface: 'gras',
    note: null,
  },
  {
    id: 'venue-hall',
    areaId: AREA_ID,
    name: 'Sporthallen',
    surface: 'inomhus',
    note: 'Bokas via föreningen – kolla att tiden är fri.',
  },
];

export function createSeedData(): DataStore {
  const now = new Date();
  const people: Person[] = PEOPLE.map(([id, name, color, favoriteTypes]) => ({
    id,
    areaId: AREA_ID,
    name,
    color,
    favoriteTypes,
  }));

  const sessions: Session[] = [
    {
      id: 'session-kvallsmatch',
      areaId: AREA_ID,
      hostId: 'person-milo',
      type: 'match',
      venueId: 'venue-ip',
      startsAt: iso(soon(3)),
      durationMin: 90,
      minPlayers: 8,
      maxPlayers: 16,
      vibe: 'alla',
      note: 'Smålagsspel 5 mot 5, vi byter lag efter varje mål. Ta med både mörk och ljus tröja.',
      status: 'open',
      createdAt: iso(soon(-20)),
    },
    {
      id: 'session-lunchlop',
      areaId: AREA_ID,
      hostId: 'person-sara',
      type: 'kondition',
      venueId: 'venue-ang',
      startsAt: iso(atDay(1, 12, 0)),
      durationMin: 45,
      minPlayers: 1,
      maxPlayers: null,
      vibe: 'lugnt',
      note: 'Lugn distans runt ängen, ca 6 km. Vi väntar in varandra.',
      status: 'open',
      createdAt: iso(soon(-30)),
    },
    {
      id: 'session-grusspel',
      areaId: AREA_ID,
      hostId: 'person-vera',
      type: 'spontan',
      venueId: 'venue-grus',
      startsAt: iso(atDay(2, 18, 30)),
      durationMin: 60,
      minPlayers: 2,
      maxPlayers: null,
      vibe: 'alla',
      note: 'Skjuta, straffar, en-mot-en. Kom och gå som du vill.',
      status: 'open',
      createdAt: iso(soon(-40)),
    },
    {
      id: 'session-malvakt',
      areaId: AREA_ID,
      hostId: 'person-eddie',
      type: 'malvakt',
      venueId: 'venue-ip',
      startsAt: iso(atDay(4, 17, 0)),
      durationMin: 45,
      minPlayers: 2,
      maxPlayers: 8,
      vibe: 'tavling',
      note: 'Målvakt söker skyttar. Jag tar med bollar.',
      status: 'open',
      createdAt: iso(soon(-50)),
    },
    {
      id: 'session-igar',
      areaId: AREA_ID,
      hostId: 'person-nils',
      type: 'match',
      venueId: 'venue-ip',
      startsAt: iso(atDay(-1, 18, 0)),
      durationMin: 90,
      minPlayers: 8,
      maxPlayers: 16,
      vibe: 'alla',
      note: null,
      status: 'open',
      createdAt: iso(atDay(-3, 9, 0)),
    },
  ];

  let signupCounter = 0;
  const signup = (sessionId: string, personId: string, status: Signup['status']): Signup => ({
    id: `signup-${++signupCounter}`,
    sessionId,
    personId,
    status,
    createdAt: iso(new Date(now.getTime() - (60 - signupCounter) * 60_000)),
  });

  const signups: Signup[] = [
    // Kvällsmatchen: 6 ja + 2 kanske → saknas 2 för att den ska bli av.
    signup('session-kvallsmatch', 'person-milo', 'ja'),
    signup('session-kvallsmatch', 'person-ada', 'ja'),
    signup('session-kvallsmatch', 'person-nils', 'ja'),
    signup('session-kvallsmatch', 'person-jonas', 'ja'),
    signup('session-kvallsmatch', 'person-tuva', 'ja'),
    signup('session-kvallsmatch', 'person-hugo', 'ja'),
    signup('session-kvallsmatch', 'person-vera', 'kanske'),
    signup('session-kvallsmatch', 'person-lova', 'kanske'),
    signup('session-kvallsmatch', 'person-sara', 'nej'),

    signup('session-lunchlop', 'person-sara', 'ja'),
    signup('session-lunchlop', 'person-lova', 'ja'),

    signup('session-grusspel', 'person-vera', 'ja'),
    signup('session-grusspel', 'person-eddie', 'ja'),
    signup('session-grusspel', 'person-tuva', 'kanske'),

    signup('session-malvakt', 'person-eddie', 'ja'),

    signup('session-igar', 'person-nils', 'ja'),
    signup('session-igar', 'person-milo', 'ja'),
    signup('session-igar', 'person-hugo', 'ja'),
  ];

  const expires = iso(atDay(INTENT_DEFAULT_DAYS, 23, 59));
  let intentCounter = 0;
  const intent = (
    personId: string,
    types: Intent['types'],
    weekdays: number[],
    dayparts: Intent['dayparts'],
    note: string | null,
  ): Intent => ({
    id: `intent-${++intentCounter}`,
    personId,
    areaId: AREA_ID,
    types,
    weekdays,
    dayparts,
    note,
    createdAt: iso(soon(-24)),
    expiresAt: expires,
  });

  const intents: Intent[] = [
    intent('person-jonas', ['match'], [], ['kvall'], 'Vilken kväll som helst, bara det blir spel.'),
    intent('person-tuva', ['match', 'spontan'], [], ['kvall'], null),
    intent('person-hugo', ['match', 'teknik'], [], ['eftermiddag', 'kvall'], 'Kan hämta bollar.'),
    intent('person-lova', ['match', 'kondition'], [], ['morgon', 'kvall'], null),
    intent('person-ada', ['teknik', 'match'], [], ['kvall'], 'Vill nöta avslut.'),
    intent('person-eddie', ['malvakt'], [], ['eftermiddag', 'kvall'], 'Ställer mig i mål när som.'),
  ];

  return {
    areas: [{ id: AREA_ID, name: 'Skultuna', joinCode: 'SKULTUNA' }],
    people,
    venues: VENUES,
    sessions,
    signups,
    intents,
    version: SEED_VERSION,
  };
}
