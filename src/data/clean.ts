/**
 * Removes `undefined` properties, deeply. IndexedDB stores them but JSON drops them, so without
 * this a record would not equal its own backup. Every write goes through here.
 */
export function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v: unknown) => clean(v)) as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      if (v !== undefined) out[key] = clean(v);
    }
    return out as T;
  }
  return value;
}
