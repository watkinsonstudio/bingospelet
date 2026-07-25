// Uppslag mot datalagret. Håller komponenterna fria från find()-kedjor.

import type { Area, DataStore, Person, Session, Venue } from '../data/types';

export function getPerson(db: DataStore, personId: string | null): Person | null {
  if (!personId) return null;
  return db.people.find((p) => p.id === personId) ?? null;
}

export function getVenue(db: DataStore, venueId: string | null): Venue | null {
  if (!venueId) return null;
  return db.venues.find((v) => v.id === venueId) ?? null;
}

export function getSession(db: DataStore, sessionId: string | null): Session | null {
  if (!sessionId) return null;
  return db.sessions.find((s) => s.id === sessionId) ?? null;
}

export function getArea(db: DataStore, areaId: string | null): Area | null {
  if (!areaId) return null;
  return db.areas.find((a) => a.id === areaId) ?? null;
}

/** Slår upp område på inbjudningskod (skiftlägesokänsligt). */
export function areaByCode(db: DataStore, code: string): Area | null {
  const needle = code.trim().toUpperCase();
  return db.areas.find((a) => a.joinCode.toUpperCase() === needle) ?? null;
}

export function peopleIn(db: DataStore, areaId: string | null): Person[] {
  if (!areaId) return [];
  return db.people.filter((p) => p.areaId === areaId).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

export function venuesIn(db: DataStore, areaId: string | null): Venue[] {
  if (!areaId) return [];
  return db.venues.filter((v) => v.areaId === areaId).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

export function sessionsIn(db: DataStore, areaId: string | null): Session[] {
  if (!areaId) return [];
  return db.sessions.filter((s) => s.areaId === areaId);
}

/** Initialer för avatarer: "Ada Lindqvist" → "AL", "Milo" → "M". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}
