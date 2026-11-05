import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { logItems, setLabel, workingSetsDone } from '../../../src/domain/log-layout';
import type { Block, LoggedSet } from '../../../src/domain/schemas';
import { draftFromSet } from '../../../src/domain/set-draft';
import { makeSet } from './helpers';

const exercise = (id: string) =>
  SEED_EXERCISES.find((e) => e.id === id) as (typeof SEED_EXERCISES)[0];

const exerciseBlock = (id: string, order: number, group?: string): Block => ({
  kind: 'exercise',
  id,
  order,
  exerciseId: 'squat',
  setsMin: 3,
  target: {},
  warmupSets: 0,
  ...(group ? { supersetGroup: group } : {}),
});

const choiceBlock = (id: string, order: number): Block => ({
  kind: 'choice',
  id,
  order,
  setsMin: 3,
  target: {},
  warmupSets: 0,
  choiceSlot: { id: 's', label: 'Accessory', options: [] },
});

const se = (id: string, order: number, blockId: string | null) => ({ id, order, blockId });

describe('logItems', () => {
  it('orders exercises and open choices together', () => {
    const blocks = [exerciseBlock('b0', 0), choiceBlock('c', 1), exerciseBlock('b2', 2)];
    const items = logItems([se('b', 2, 'b2'), se('a', 0, 'b0')], blocks);
    expect(
      items.map((i) => (i.kind === 'choice' ? i.block.id : i.exercises.map((e) => e.id))),
    ).toEqual([['a'], 'c', ['b']]);
  });

  it('joins exercises of a superset in one card', () => {
    const blocks = [
      exerciseBlock('b0', 0, 'g'),
      exerciseBlock('b1', 1, 'g'),
      exerciseBlock('b2', 2),
    ];
    const items = logItems([se('a', 0, 'b0'), se('b', 1, 'b1'), se('c', 2, 'b2')], blocks);
    expect(
      items.map((i) => (i.kind === 'choice' ? 'choice' : i.exercises.map((e) => e.id))),
    ).toEqual([['a', 'b'], ['c']]);
  });

  it('keeps superset members apart when something sits between them', () => {
    const blocks = [exerciseBlock('b0', 0, 'g'), exerciseBlock('b1', 2, 'g')];
    const items = logItems([se('a', 0, 'b0'), se('x', 1, null), se('b', 2, 'b1')], blocks);
    expect(items).toHaveLength(3);
  });

  it('handles an empty workout', () => {
    expect(logItems([se('a', 0, null)], [])).toHaveLength(1);
    expect(logItems([], [])).toEqual([]);
  });
});

describe('set labels and counts', () => {
  const sets: LoggedSet[] = [
    makeSet({ sessionId: 's', exerciseId: 'squat', id: 'w', kind: 'warmup', order: 0 }),
    makeSet({ sessionId: 's', exerciseId: 'squat', id: 'a', order: 1 }),
    makeSet({ sessionId: 's', exerciseId: 'squat', id: 'b', order: 2, done: false }),
  ];

  it('numbers working sets on their own', () => {
    expect(setLabel(sets, sets[0] as LoggedSet)).toEqual({ text: 'Warm-up 1', number: 1 });
    expect(setLabel(sets, sets[2] as LoggedSet)).toEqual({ text: 'Set 2', number: 2 });
  });

  it('counts done working sets, and a checklist item is not one', () => {
    const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
    const warmUp = makeSet({ sessionId: 's', exerciseId: 'warm-up' });
    expect(workingSetsDone([...sets, warmUp], byId)).toBe(1);
  });
});

describe('draftFromSet', () => {
  it('reopens a done set with its own values, attempts included', () => {
    const set = makeSet({ sessionId: 's', exerciseId: '540', attempts: 6, cleanAttempts: 4 });
    expect(draftFromSet(set, exercise('540'))).toMatchObject({ attempts: 6, cleanAttempts: 4 });
  });

  it('keeps logged complex parts even when the plan has none', () => {
    const parts = [{ name: 'Hold', unit: 'seconds' as const, value: 4 }];
    const set = makeSet({ sessionId: 's', exerciseId: 'planche-complex', parts });
    expect(draftFromSet(set, exercise('planche-complex')).parts).toEqual(parts);
  });
});
