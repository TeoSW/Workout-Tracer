import { describe, expect, it } from 'vitest';
import {
  activateProgram,
  createProgramFromTemplate,
  deleteDayTemplate,
  getProgram,
  saveDayTemplate,
  updateProgram,
} from '../../../src/data/programs';
import {
  extendRestTimer,
  getRestTimer,
  skipRestTimer,
  startRestTimer,
} from '../../../src/data/rest-timer';
import { seedIfNeeded } from '../../../src/data/seed';
import {
  addExercise,
  addSet,
  deleteSession,
  finishSession,
  getActiveSession,
  getSessionView,
  moveExercise,
  pickChoice,
  removeExercise,
  removeSet,
  startEmptySession,
  startPlannedSession,
  swapExercise,
  toggleWarmup,
  updateSession,
  updateSet,
} from '../../../src/data/sessions';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import type { DayTemplate } from '../../../src/domain/schemas';
import { reopen, testContext } from './helpers';

async function setup(template = PROGRAM_C) {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  const { program, dayTemplates } = await createProgramFromTemplate(ctx, template);
  await activateProgram(ctx, program.id, 'this_week');
  const day = (name: string): DayTemplate => {
    const found = dayTemplates.find((d) => d.name === name);
    if (!found) throw new Error(`No day ${name}`);
    return found;
  };
  return { ctx, program, day };
}

describe('starting sessions', () => {
  it('stores the resolved plan, exercises and empty set rows', async () => {
    const { ctx, program, day } = await setup();
    const heavy = day('Heavy (planche first)');
    const view = await startPlannedSession(ctx, { programId: program.id, dayTemplateId: heavy.id });
    expect(view.session).toMatchObject({
      programId: program.id,
      dayTemplateId: heavy.id,
      name: 'Heavy (planche first)',
      dayType: 'skill_heavy',
      status: 'active',
      date: '2026-11-02',
      cycleNumber: 1,
      cycleWeek: 1,
      isDeload: false,
      rotationIndex: null,
    });
    expect(view.exercises.map((e) => [e.exerciseId, e.sets.length])).toEqual([
      ['warm-up', 1],
      ['planche-complex', 3],
      ['front-lever-complex', 3],
      ['weighted-dips', 2],
      ['weighted-pull-ups', 2],
      ['lateral-raise', 3],
      ['bicep-curl', 2],
    ]);
    expect(view.session.planSnapshot?.blocks[3]?.kind).toBe('choice');
    expect((await getActiveSession(ctx))?.session.id).toBe(view.session.id);
  });

  it('refuses a second active session', async () => {
    const { ctx } = await setup();
    await startEmptySession(ctx);
    await expect(startEmptySession(ctx)).rejects.toThrow(
      'Finish or discard the current workout first.',
    );
  });

  it('stores the rotation index, including for a day started out of turn', async () => {
    const { ctx, program, day } = await setup(PROGRAM_A);
    const first = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Upper A').id,
    });
    expect(first.session.rotationIndex).toBe(0);
    await finishSession(ctx, first.session.id);
    const outOfTurn = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Lower B').id,
    });
    expect(outOfTurn.session.rotationIndex).toBe(3);
  });
});

describe('acceptance 13: plan snapshots', () => {
  it('leaves a session plan unchanged when the program is edited or deleted afterwards', async () => {
    const { ctx, program, day } = await setup();
    const heavy = day('Heavy (planche first)');
    const view = await startPlannedSession(ctx, { programId: program.id, dayTemplateId: heavy.id });
    const before = structuredClone(view.session.planSnapshot);

    await saveDayTemplate(ctx, {
      ...heavy,
      name: 'Heavy renamed',
      blocks: heavy.blocks
        .slice(2)
        .map((b) => ({ ...b, setsMin: 5, target: { ...b.target, repsMin: 1 } })),
    });
    const loaded = await getProgram(ctx, program.id);
    if (!loaded) throw new Error('missing program');
    await updateProgram(ctx, { ...loaded.program, name: 'Edited' });
    await deleteDayTemplate(ctx, heavy.id);

    expect((await getSessionView(ctx, view.session.id))?.session.planSnapshot).toEqual(before);
  });
});

describe('logging', () => {
  it('logs, adds, removes and toggles sets, and stamps completion time', async () => {
    const { ctx, program, day } = await setup();
    const view = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Legs').id,
    });
    const lumbar = view.exercises[0];
    const firstSet = lumbar?.sets[0];
    if (!lumbar || !firstSet) throw new Error('missing rows');
    ctx.clock.advance(60_000);
    const done = await updateSet(ctx, firstSet.id, { kg: 15, reps: 10, rir: 2, done: true });
    expect(done).toMatchObject({
      kg: 15,
      reps: 10,
      rir: 2,
      done: true,
      completedAt: ctx.clock.now(),
    });
    expect((await updateSet(ctx, firstSet.id, { done: false })).completedAt).toBeNull();
    await expect(updateSet(ctx, firstSet.id, { rir: 1.25 })).rejects.toThrow();

    const added = await addSet(ctx, lumbar.id);
    expect(added).toMatchObject({
      order: 3,
      kind: 'working',
      target: firstSet.target,
      done: false,
    });
    expect((await toggleWarmup(ctx, added.id)).kind).toBe('warmup');
    await removeSet(ctx, added.id);
    expect((await getSessionView(ctx, view.session.id))?.exercises[0]?.sets).toHaveLength(3);
  });

  it('refuses added kg together with bands on a bodyweight set', async () => {
    const { ctx } = await setup();
    const session = await startEmptySession(ctx);
    const pullUps = await addExercise(ctx, session.session.id, 'pull-ups');
    const set = pullUps.sets[0];
    if (!set) throw new Error('missing set');
    await expect(updateSet(ctx, set.id, { addedKg: 5, bandIds: ['band-15'] })).rejects.toThrow(
      'Use added weight or bands, not both.',
    );
  });

  it('adds, moves, swaps and removes exercises', async () => {
    const { ctx } = await setup();
    const { session } = await startEmptySession(ctx);
    const squat = await addExercise(ctx, session.id, 'squat');
    const curl = await addExercise(ctx, session.id, 'bicep-curl');
    expect([squat.order, curl.order]).toEqual([0, 1]);
    await moveExercise(ctx, curl.id, 'up');
    let view = await getSessionView(ctx, session.id);
    expect(view?.exercises.map((e) => e.exerciseId)).toEqual(['bicep-curl', 'squat']);
    await moveExercise(ctx, curl.id, 'up');

    await swapExercise(ctx, curl.id, 'hammer-curl');
    await swapExercise(ctx, curl.id, 'bicep-curl');
    await swapExercise(ctx, curl.id, 'hammer-curl');
    view = await getSessionView(ctx, session.id);
    expect(view?.exercises[0]).toMatchObject({
      exerciseId: 'hammer-curl',
      swappedFromExerciseId: 'bicep-curl',
    });
    expect(view?.exercises[0]?.sets.every((s) => s.exerciseId === 'hammer-curl')).toBe(true);
    await expect(swapExercise(ctx, curl.id, 'nope')).rejects.toThrow();

    await removeExercise(ctx, squat.id);
    view = await getSessionView(ctx, session.id);
    expect(view?.exercises).toHaveLength(1);
    expect(await ctx.db.sets.where('sessionExerciseId').equals(squat.id).count()).toBe(0);
  });

  it('picks a choice, creates its rows in place and saves the pick for the cycle', async () => {
    const { ctx, program, day } = await setup();
    ctx.clock.set(Date.parse('2026-12-07T10:00:00')); // week 6 Monday, a deload week
    const view = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Heavy (planche first)').id,
    });
    const block = view.session.planSnapshot?.blocks.find((b) => b.kind === 'choice');
    if (block?.kind !== 'choice') throw new Error('missing choice block');
    const after = await pickChoice(ctx, view.session.id, block.id, 2);
    expect(after.exercises.map((e) => e.exerciseId)[3]).toBe('hollow-body-hold');
    expect(after.exercises[3]?.sets).toHaveLength(2);
    expect(after.session.planSnapshot?.blocks[3]).toMatchObject({
      kind: 'exercise',
      exerciseId: 'hollow-body-hold',
      setsMin: 2,
    });
    const saved = await getProgram(ctx, program.id);
    expect(saved?.program.choiceSelections).toEqual([
      { cycleNumber: 1, slotId: block.choiceSlot.id, optionIndex: 2 },
    ]);
    await expect(pickChoice(ctx, view.session.id, block.id, 0)).rejects.toThrow();
  });
});

describe('finishing', () => {
  it('finishes, clears the rest timer and reports beaten records', async () => {
    const { ctx } = await setup();
    const first = await startEmptySession(ctx);
    const squat1 = await addExercise(ctx, first.session.id, 'squat');
    await updateSet(ctx, squat1.sets[0]?.id ?? '', { kg: 25, reps: 10, rir: 2, done: true });
    const firstResult = await finishSession(ctx, first.session.id, 'Felt fine.');
    expect(firstResult.prs).toEqual([]);
    expect(firstResult.session).toMatchObject({
      status: 'finished',
      notes: 'Felt fine.',
      finishedAt: ctx.clock.now(),
    });

    ctx.clock.advance(2 * 86_400_000);
    const second = await startEmptySession(ctx);
    const squat2 = await addExercise(ctx, second.session.id, 'squat');
    await updateSet(ctx, squat2.sets[0]?.id ?? '', { kg: 25, reps: 11, rir: 2, done: true });
    await startRestTimer(ctx, second.session.id, 120);
    const result = await finishSession(ctx, second.session.id);
    expect(result.prs.map((p) => [p.exerciseId, p.kind])).toEqual([
      ['squat', 'best_e1rm'],
      ['squat', 'most_reps'],
    ]);
    expect(await getRestTimer(ctx)).toBeUndefined();
    expect(await getActiveSession(ctx)).toBeNull();
    await expect(finishSession(ctx, second.session.id)).rejects.toThrow();
  });

  it('edits and deletes a finished session', async () => {
    const { ctx } = await setup();
    const { session } = await startEmptySession(ctx);
    await addExercise(ctx, session.id, 'squat');
    await finishSession(ctx, session.id);
    expect(
      (await updateSession(ctx, session.id, { notes: 'Edited.', name: 'Morning' })).notes,
    ).toBe('Edited.');
    await deleteSession(ctx, session.id);
    expect(await getSessionView(ctx, session.id)).toBeNull();
    expect(await ctx.db.sets.count()).toBe(0);
    expect(await ctx.db.sessionExercises.count()).toBe(0);
  });
});

describe('rest timer and reloads', () => {
  it('keeps the active session and the remaining rest across a reload', async () => {
    const { ctx, program, day } = await setup();
    const view = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day('Legs').id,
    });
    const set = view.exercises[0]?.sets[0];
    await updateSet(ctx, set?.id ?? '', { kg: 15, reps: 10, done: true });
    await startRestTimer(ctx, view.session.id, 90);
    await extendRestTimer(ctx, 15);
    ctx.clock.advance(30_000);

    const after = reopen(ctx);
    const active = await getActiveSession(after);
    expect(active?.exercises[0]?.sets[0]).toMatchObject({ kg: 15, reps: 10, done: true });
    const timer = await getRestTimer(after);
    expect(timer && timer.endsAt - after.clock.now()).toBe(75_000);
    await skipRestTimer(after);
    expect(await getRestTimer(after)).toBeUndefined();
    await expect(extendRestTimer(after, 15)).rejects.toThrow();
  });
});
