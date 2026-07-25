// Sugen-status: appens egentliga kärna. En sugen-status har ingen exakt tid –
// bara "det här vill jag göra, ungefär då". Logiken här gör två saker:
//
//   1. matchar sugna mot ett befintligt pass (vilka är värda att pinga?), och
//   2. hittar överlapp mellan flera sugna och föreslår ett pass att starta.
//
// Allt är rena funktioner med inskickad klocka – testade i intents.test.ts.

import { DAYPART_HOURS, DAYPARTS } from '../data/types';
import type { ActivityType, Daypart, Intent, Session, Signup } from '../data/types';

/** Klockslag som föreslås när en sugen-status blir ett skarpt pass. */
export const PROPOSED_HOUR: Record<Daypart, number> = {
  morgon: 8,
  lunch: 12,
  eftermiddag: 16,
  kvall: 18,
};

/** Sugen-status som fortfarande gäller. */
export function activeIntents(intents: Intent[], now: Date): Intent[] {
  const t = now.getTime();
  return intents.filter((i) => new Date(i.expiresAt).getTime() > t);
}

/** En persons aktiva sugen-status, eller null. */
export function intentOf(intents: Intent[], personId: string, now: Date): Intent | null {
  return activeIntents(intents, now).find((i) => i.personId === personId) ?? null;
}

/** Vilken del av dygnet ett klockslag hör till. Småtimmarna räknas som kväll. */
export function daypartOfDate(date: Date): Daypart {
  const hour = date.getHours();
  for (const part of DAYPARTS) {
    const [from, to] = DAYPART_HOURS[part];
    if (hour >= from && hour < to) return part;
  }
  return 'kvall';
}

/**
 * Täcker sugen-statusen den här aktiviteten vid den här tidpunkten?
 * Tomma listor betyder "spelar ingen roll" – det är avsiktligt generöst, en
 * sugen person vill hellre bli tillfrågad en gång för mycket.
 */
export function intentCovers(intent: Intent, type: ActivityType, when: Date): boolean {
  const typeOk = intent.types.length === 0 || intent.types.includes(type);
  const dayOk = intent.weekdays.length === 0 || intent.weekdays.includes(when.getDay());
  const partOk = intent.dayparts.length === 0 || intent.dayparts.includes(daypartOfDate(when));
  return typeOk && dayOk && partOk;
}

/**
 * Personer som är sugna på precis det här passet men inte svarat än – alltså
 * exakt de som är värda att pinga. Värden själv räknas aldrig med.
 */
export function pingCandidates(
  intents: Intent[],
  session: Session,
  signups: Signup[],
  now: Date,
): string[] {
  const answered = new Set(
    signups.filter((s) => s.sessionId === session.id).map((s) => s.personId),
  );
  const when = new Date(session.startsAt);
  return activeIntents(intents, now)
    .filter((i) => i.areaId === session.areaId)
    .filter((i) => i.personId !== session.hostId && !answered.has(i.personId))
    .filter((i) => intentCovers(i, session.type, when))
    .map((i) => i.personId);
}

/** Ett föreslaget pass, framräknat ur överlappande sugen-status. */
export interface IntentCluster {
  type: ActivityType;
  daypart: Daypart;
  /** Föreslagen starttid (ISO) – förifyller "Starta pass". */
  startsAt: string;
  personIds: string[];
}

export interface ClusterOptions {
  /** Hur många dagar framåt som scannas. */
  horizonDays?: number;
  /** Minsta antal sugna för att ett förslag ska visas. */
  minPeople?: number;
  /** Max antal förslag som returneras. */
  limit?: number;
  /**
   * Visa bara det bästa förslaget per aktivitet. Utan detta fylls flödet av
   * samma gäng och samma matchspel, en gång per kväll i veckan.
   */
  onePerType?: boolean;
}

/**
 * Letar upp tidpunkter där flera personer är sugna på samma sak samtidigt.
 * Varje träff blir ett färdigt förslag: "5 är sugna på matchspel på torsdag
 * kväll – starta passet". Sorteras på flest sugna, därefter det som händer först.
 */
export function intentClusters(
  intents: Intent[],
  now: Date,
  options: ClusterOptions = {},
): IntentCluster[] {
  const { horizonDays = 7, minPeople = 2, limit = 5, onePerType = true } = options;
  const active = activeIntents(intents, now);
  const clusters: IntentCluster[] = [];

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    for (const daypart of DAYPARTS) {
      const start = proposedStart(now, dayOffset, daypart);
      if (start.getTime() <= now.getTime()) continue; // slotten har redan passerat

      const byType = new Map<ActivityType, string[]>();
      for (const intent of active) {
        if (new Date(intent.expiresAt).getTime() < start.getTime()) continue;
        for (const type of intent.types) {
          if (!intentCovers(intent, type, start)) continue;
          const list = byType.get(type) ?? [];
          if (!list.includes(intent.personId)) list.push(intent.personId);
          byType.set(type, list);
        }
      }

      for (const [type, personIds] of byType) {
        if (personIds.length < minPeople) continue;
        clusters.push({ type, daypart, startsAt: start.toISOString(), personIds });
      }
    }
  }

  const ranked = clusters.sort(
    (a, b) => b.personIds.length - a.personIds.length || a.startsAt.localeCompare(b.startsAt),
  );
  if (!onePerType) return ranked.slice(0, limit);

  const seen = new Set<ActivityType>();
  return ranked
    .filter((cluster) => {
      if (seen.has(cluster.type)) return false;
      seen.add(cluster.type);
      return true;
    })
    .slice(0, limit);
}

/** Föreslagen starttidpunkt för en viss dag framåt och del av dygnet. */
export function proposedStart(now: Date, dayOffset: number, daypart: Daypart): Date {
  const start = new Date(now);
  start.setDate(start.getDate() + dayOffset);
  start.setHours(PROPOSED_HOUR[daypart], 0, 0, 0);
  return start;
}
