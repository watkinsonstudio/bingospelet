/**
 * Genererar ett unikt id. Använder crypto.randomUUID när det finns (säker
 * kontext), annars en enkel fallback så att appen även fungerar när den öppnas
 * från en fristående fil eller äldre miljö.
 */
export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* faller igenom till fallback */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
