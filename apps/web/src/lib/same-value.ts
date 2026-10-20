/**
 * Whether two JSON values hold the same data, whatever the order of their keys: the server
 * stores settings as jsonb, which reorders them, and echoes them back after a save.
 */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a))
    return a.length === (b as unknown[]).length && a.every((v, i) => sameValue(v, (b as unknown[])[i]));
  const keys = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const other = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  return (
    keys.length === other.length &&
    keys.every((k) => sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}
