import type { LoggedSet } from './schemas';

/**
 * The set to prefill from, out of one exercise's sets in the latest finished session: the same
 * set number, otherwise the last set of that session. `setNumber` counts from 1 within `kind`.
 * The caller falls back to the plan when this is null.
 */
export function lastTimeSet(
  sets: readonly LoggedSet[],
  kind: LoggedSet['kind'],
  setNumber: number,
): LoggedSet | null {
  const matching = sets.filter((s) => s.done && s.kind === kind).sort((a, b) => a.order - b.order);
  return matching[setNumber - 1] ?? matching.at(-1) ?? null;
}
