import { describe, expect, it } from 'vitest';
import {
  activateProgram,
  addSessionAsDay,
  createProgramFromTemplate,
  getProgram,
  saveSessionAsProgram,
} from '../../../src/data/programs';
import { seedIfNeeded } from '../../../src/data/seed';
import {
  addExercise,
  addSet,
  finishSession,
  getActiveSession,
  startEmptySession,
  startPlannedSession,
  updateSet,
} from '../../../src/data/sessions';
import { PROGRAM_B } from '../../../src/domain/fixtures/templates';
import { testContext } from './helpers';

async function customWorkout() {
  const ctx = testContext();
  await seedIfNeeded(ctx);
  const { session } = await startEmptySession(ctx);
  await addExercise(ctx, session.id, 'squat');
  await addExercise(ctx, session.id, 'plank');
  const view = await getActiveSession(ctx);
  const squat = view?.exercises.find((e) => e.exerciseId === 'squat');
  const plank = view?.exercises.find((e) => e.exerciseId === 'plank');
  if (!squat || !plank) throw new Error('missing exercises');
  await addSet(ctx, squat.id);
  const squatSets = (await getActiveSession(ctx))?.exercises.find((e) => e.id === squat.id)?.sets;
  await updateSet(ctx, squatSets?.[0]?.id ?? '', { kg: 60, reps: 8, rir: 2, done: true });
  await updateSet(ctx, squatSets?.[1]?.id ?? '', {
    kg: 60,
    reps: 7,
    rir: 1,
    note: 'Grind',
    done: true,
  });
  await updateSet(ctx, plank.sets[0]?.id ?? '', { seconds: 45, done: true });
  await finishSession(ctx, session.id);
  return { ctx, sessionId: session.id };
}

describe('saving a workout as a program', () => {
  it('makes a program with one day: the same exercises, sets and values, and each set’s effort', async () => {
    const { ctx, sessionId } = await customWorkout();
    const { program, dayTemplates } = await saveSessionAsProgram(ctx, sessionId, ' Gym day ');
    expect(program).toMatchObject({ name: 'Gym day', active: false, splitType: 'custom' });
    const [day] = dayTemplates;
    expect(day?.name).toBe('Gym day');
    expect(day?.blocks.map((b) => (b.kind === 'exercise' ? b.exerciseId : ''))).toEqual([
      'squat',
      'plank',
    ]);
    expect(day?.blocks[0]).toMatchObject({
      setsMin: 2,
      target: { repsMin: 8, loadMinKg: 60 },
      setTargets: [{ rir: 2 }, { rir: 1, note: 'Grind' }],
    });
    expect(day?.blocks[1]).toMatchObject({ setsMin: 1, target: { secondsMin: 45 } });
    expect((await getProgram(ctx, program.id))?.dayTemplates).toHaveLength(1);
  });

  it('adds a workout to an existing program as a new day', async () => {
    const { ctx, sessionId } = await customWorkout();
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_B);
    await activateProgram(ctx, program.id, 'this_week');
    const day = await addSessionAsDay(ctx, sessionId, program.id, 'Extra');
    const loaded = await getProgram(ctx, program.id);
    expect(loaded?.dayTemplates.map((d) => d.name)).toContain('Extra');
    expect(day.blocks).toHaveLength(2);
    // The new day can be started like any other.
    const started = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: day.id,
    });
    expect(started.exercises).toHaveLength(2);
  });

  it('asks for a name and refuses an empty workout', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { session } = await startEmptySession(ctx);
    await expect(saveSessionAsProgram(ctx, session.id, '  ')).rejects.toThrow(
      'Give the program a name.',
    );
    await expect(saveSessionAsProgram(ctx, session.id, 'Nothing')).rejects.toThrow(
      'This workout has no sets to save.',
    );
  });
});
