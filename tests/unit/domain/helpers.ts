/** Deterministic id generator for tests. */
export function counterIds(prefix = 'id'): () => string {
  let n = 0;
  return () => `${prefix}-${++n}`;
}
