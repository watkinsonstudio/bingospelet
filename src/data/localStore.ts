import type { DataStore } from './types';
import { SEED_VERSION, createSeedData } from './seed';

const STORAGE_KEY = 'sommarbingo:db';

/**
 * Läser hela datalagret från localStorage. Vid saknad eller inaktuell data
 * (annan schemaversion) seedas en ny uppsättning. All lagring sker lokalt i
 * webbläsaren – inga personuppgifter lämnar enheten (GDPR-snålt, spec avsnitt 2).
 */
export function loadStore(): DataStore {
  if (typeof localStorage === 'undefined') return createSeedData();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedAndPersist();
    const parsed = JSON.parse(raw) as DataStore;
    if (!parsed || parsed.version !== SEED_VERSION) return seedAndPersist();
    return parsed;
  } catch {
    return seedAndPersist();
  }
}

/** Sparar hela datalagret. */
export function saveStore(db: DataStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Full lagring eller privat läge – appen fortsätter fungera i minnet.
  }
}

/** Nollställer allt till seed-datan (för demo/utveckling). */
export function resetStore(): DataStore {
  return seedAndPersist();
}

function seedAndPersist(): DataStore {
  const db = createSeedData();
  saveStore(db);
  return db;
}
