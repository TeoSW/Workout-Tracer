import { describe, expect, it } from 'vitest';
import { CSV_HEADER, setRowsToCsv } from '../../../src/domain/csv';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import { PROGRAM_A, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import { planProgramImport } from '../../../src/domain/import';
import { resolvePlan } from '../../../src/domain/plan';
import type { Band, DayTemplate, Exercise } from '../../../src/domain/schemas';
import { buildRowsForBlock, buildSessionRows } from '../../../src/domain/session-rows';
import { buildProgramShare } from '../../../src/domain/share';
import { instantiateTemplate } from '../../../src/domain/templates';
import { ANCHOR, activeProgram, counterIds, dayByName } from './helpers';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
const bandsById = new Map(SEED_BANDS.map((b) => [b.id, b]));

function blockExerciseIds(days: DayTemplate[]): string[] {
  return days.flatMap((d) =>
    d.blocks.flatMap((b) =>
      b.kind === 'exercise' ? [b.exerciseId] : b.choiceSlot.options.map((o) => o.exerciseId),
    ),
  );
}

function shareOf(template = PROGRAM_C, extra?: (days: DayTemplate[]) => void) {
  const { program, dayTemplates } = instantiateTemplate(template, { newId: counterIds('src') });
  extra?.(dayTemplates);
  return { program, dayTemplates };
}

describe('planProgramImport', () => {
  it('creates fresh ids and keeps schedule references and shared choice slots', () => {
    const { program, dayTemplates } = shareOf();
    const share = buildProgramShare(program, dayTemplates, exercisesById, bandsById);
    const result = planProgramImport({
      share,
      existingExercises: SEED_EXERCISES,
      existingBands: SEED_BANDS,
      existingProgramNames: [],
      newId: counterIds('imp'),
    });
    if (!result.ok) throw new Error(result.error);
    const plan = result.plan;
    const oldIds = new Set([
      program.id,
      ...dayTemplates.flatMap((d) => [d.id, ...d.blocks.map((b) => b.id)]),
    ]);
    for (const id of [
      plan.program.id,
      ...plan.dayTemplates.flatMap((d) => [d.id, ...d.blocks.map((b) => b.id)]),
    ]) {
      expect(oldIds.has(id)).toBe(false);
    }
    const dayIds = new Set(plan.dayTemplates.map((d) => d.id));
    if (plan.program.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    for (const week of plan.program.schedule.weeks) {
      for (const id of Object.values(week)) if (id !== null) expect(dayIds.has(id)).toBe(true);
    }
    const slots = plan.dayTemplates.flatMap((d) =>
      d.blocks.flatMap((b) => (b.kind === 'choice' ? [b.choiceSlot.id] : [])),
    );
    expect(new Set(slots).size).toBe(1);
    expect(plan.newExercises).toEqual([]);
    expect(plan.newBands).toEqual([]);
    expect(blockExerciseIds(plan.dayTemplates)).toEqual(blockExerciseIds(dayTemplates));
    expect(plan.program.name).toBe('Calisthenics 6-week cycle');
  });

  it('matches custom exercises by name in any case and creates the missing ones', () => {
    const base = SEED_EXERCISES[0] as Exercise;
    const senderRow: Exercise = {
      ...base,
      id: 'sender-row',
      name: 'Ring Row',
      isCustom: true,
      alternativeIds: ['sender-dip'],
    };
    const senderDip: Exercise = {
      ...base,
      id: 'sender-dip',
      name: 'Bench Dip',
      isCustom: true,
      alternativeIds: ['sender-row'],
    };
    const { program, dayTemplates } = shareOf(PROGRAM_A, (days) => {
      days[0]?.blocks.push(
        {
          kind: 'exercise',
          id: 'x1',
          order: 9,
          exerciseId: 'sender-row',
          setsMin: 2,
          target: {},
          warmupSets: 0,
        },
        {
          kind: 'exercise',
          id: 'x2',
          order: 10,
          exerciseId: 'sender-dip',
          setsMin: 2,
          target: {},
          warmupSets: 0,
        },
      );
    });
    const share = buildProgramShare(
      program,
      dayTemplates,
      new Map([...exercisesById, [senderRow.id, senderRow], [senderDip.id, senderDip]]),
      bandsById,
    );
    const mine: Exercise = { ...base, id: 'my-row', name: 'ring row', isCustom: true };
    const result = planProgramImport({
      share,
      existingExercises: [...SEED_EXERCISES, mine],
      existingBands: SEED_BANDS,
      existingProgramNames: [],
      newId: counterIds('imp'),
    });
    if (!result.ok) throw new Error(result.error);
    const { plan } = result;
    expect(plan.newExercises).toHaveLength(1);
    const dip = plan.newExercises[0];
    expect(dip).toMatchObject({
      name: 'Bench Dip',
      isCustom: true,
      archived: false,
      alternativeIds: ['my-row'],
    });
    const ids = blockExerciseIds(plan.dayTemplates);
    expect(ids).toContain('my-row');
    expect(ids).toContain(dip?.id);
    expect(ids).not.toContain('sender-row');
  });

  it('does not match archived exercises by name', () => {
    const base = SEED_EXERCISES[0] as Exercise;
    const sender: Exercise = { ...base, id: 'sender-row', name: 'Ring Row', isCustom: true };
    const { program, dayTemplates } = shareOf(PROGRAM_A, (days) => {
      days[0]?.blocks.push({
        kind: 'exercise',
        id: 'x1',
        order: 9,
        exerciseId: 'sender-row',
        setsMin: 2,
        target: {},
        warmupSets: 0,
      });
    });
    const share = buildProgramShare(
      program,
      dayTemplates,
      new Map([...exercisesById, [sender.id, sender]]),
      bandsById,
    );
    const archived: Exercise = { ...sender, id: 'old-row', archived: true };
    const result = planProgramImport({
      share,
      existingExercises: [...SEED_EXERCISES, archived],
      existingBands: SEED_BANDS,
      existingProgramNames: [],
      newId: counterIds('imp'),
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.newExercises.map((e) => e.name)).toEqual(['Ring Row']);
    expect(blockExerciseIds(result.plan.dayTemplates)).not.toContain('old-row');
  });

  it('matches bands by rated kg and creates missing ones once', () => {
    const custom: Band = { id: 'sender-5', label: '5kg', ratedKg: 5 };
    const senderBands = new Map([...bandsById, [custom.id, custom]]);
    const { program, dayTemplates } = shareOf(PROGRAM_A, (days) => {
      for (const day of days) {
        const first = day.blocks[0];
        if (first) first.target.bandIds = ['sender-5', 'band-35'];
      }
    });
    const share = buildProgramShare(program, dayTemplates, exercisesById, senderBands);
    const friendBands: Band[] = [{ id: 'friend-35', label: 'Black', ratedKg: 35 }];
    const result = planProgramImport({
      share,
      existingExercises: SEED_EXERCISES,
      existingBands: friendBands,
      existingProgramNames: [],
      newId: counterIds('imp'),
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.newBands).toEqual([{ id: expect.any(String), label: '5kg', ratedKg: 5 }]);
    const newBandId = result.plan.newBands[0]?.id;
    for (const day of result.plan.dayTemplates) {
      expect(day.blocks[0]?.target.bandIds).toEqual([newBandId, 'friend-35']);
    }
  });

  it('drops unknown band ids from old share files without a band list', () => {
    const { program, dayTemplates } = shareOf(PROGRAM_A);
    const share = buildProgramShare(program, dayTemplates, exercisesById, bandsById);
    delete share.bands;
    const result = planProgramImport({
      share,
      existingExercises: SEED_EXERCISES,
      existingBands: [{ id: 'band-35', label: '35kg', ratedKg: 35 }],
      existingProgramNames: [],
      newId: counterIds('imp'),
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.plan.dayTemplates[0]?.blocks[0]?.target.bandIds).toEqual(['band-35']);
  });

  it('renames on a name clash', () => {
    const { program, dayTemplates } = shareOf(PROGRAM_A);
    const share = buildProgramShare(program, dayTemplates, exercisesById, bandsById);
    const plan = (names: string[]) =>
      planProgramImport({
        share,
        existingExercises: SEED_EXERCISES,
        existingBands: SEED_BANDS,
        existingProgramNames: names,
        newId: counterIds('imp'),
      });
    const first = plan(['ulu/lul']);
    const second = plan(['ULU/LUL', 'ULU/LUL (2)']);
    expect(first.ok && first.plan.program.name).toBe('ULU/LUL (2)');
    expect(second.ok && second.plan.program.name).toBe('ULU/LUL (3)');
  });

  it('refuses a program that uses built-in exercises this phone does not have', () => {
    const { program, dayTemplates } = shareOf(PROGRAM_A);
    const share = buildProgramShare(program, dayTemplates, exercisesById, bandsById);
    const result = planProgramImport({
      share,
      existingExercises: SEED_EXERCISES.filter((e) => e.id !== 'kelso-shrug'),
      existingBands: SEED_BANDS,
      existingProgramNames: [],
      newId: counterIds('imp'),
    });
    expect(result).toEqual({
      ok: false,
      error:
        'This program uses exercises this app does not have yet. Update the app, then try again.',
    });
  });
});

describe('buildSessionRows', () => {
  const { program, dayTemplates } = activeProgram(PROGRAM_C);

  it('creates warm-up and working rows with target snapshots for exercise blocks only', () => {
    const day = dayByName(dayTemplates, 'Heavy (planche first)');
    const snapshot = resolvePlan({ program, dayTemplate: day, date: ANCHOR, exercisesById });
    const first = snapshot.blocks[1];
    if (first?.kind !== 'exercise') throw new Error('expected an exercise block');
    first.warmupSets = 1;
    const { sessionExercises, sets } = buildSessionRows({
      sessionId: 's1',
      snapshot,
      newId: counterIds('r'),
    });
    expect(sessionExercises.map((e) => e.exerciseId)).toEqual([
      'warm-up',
      'planche-complex',
      'front-lever-complex',
      'weighted-dips',
      'weighted-pull-ups',
      'lateral-raise',
      'bicep-curl',
    ]);
    expect(sessionExercises.map((e) => e.order)).toEqual([0, 1, 2, 4, 5, 6, 7]);
    const complexId = sessionExercises[1]?.id;
    const complexSets = sets.filter((s) => s.sessionExerciseId === complexId);
    expect(complexSets.map((s) => [s.kind, s.order])).toEqual([
      ['warmup', 0],
      ['working', 1],
      ['working', 2],
      ['working', 3],
    ]);
    expect(complexSets[1]).toMatchObject({
      sessionId: 's1',
      exerciseId: 'planche-complex',
      done: false,
      rir: null,
      completedAt: null,
      target: first.target,
    });
    expect(complexSets[1]?.target).not.toBe(first.target);
    expect(sets).toHaveLength(1 + 4 + 3 + 2 + 2 + 3 + 2);
  });

  it('builds rows for one block, for picks and added exercises', () => {
    const day = dayByName(dayTemplates, 'Legs');
    const block = day.blocks[0];
    if (block?.kind !== 'exercise') throw new Error('expected an exercise block');
    const { sessionExercise, sets } = buildRowsForBlock({
      sessionId: 's',
      block,
      order: 3,
      newId: counterIds('b'),
    });
    expect(sessionExercise).toMatchObject({
      exerciseId: 'lumbar-extension',
      order: 3,
      blockId: block.id,
      note: '',
    });
    expect(sets).toHaveLength(3);
  });
});

describe('setRowsToCsv', () => {
  it('writes the header, quotes awkward notes and uses CRLF', () => {
    const csv = setRowsToCsv([
      {
        date: '2026-11-02',
        program: 'PPLL',
        day: 'Push',
        exercise: 'Upper Chest',
        setNumber: 1,
        kind: 'working',
        kg: 4,
        reps: 10,
        rir: 2,
        note: 'felt "easy", go up\nnext time',
      },
      {
        date: '2026-11-02',
        program: '',
        day: 'Empty workout',
        exercise: 'Pull-ups',
        setNumber: 2,
        kind: 'warmup',
        bandLevel: 50,
        reps: 8,
        rir: null,
        clean: true,
      },
    ]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(CSV_HEADER).toEqual([
      'date',
      'program',
      'day',
      'exercise',
      'set number',
      'kind',
      'kg',
      'added kg',
      'band level',
      'reps',
      'seconds',
      'attempts',
      'clean attempts',
      'clean',
      'RIR',
      'RPE',
      'note',
    ]);
    expect(lines[1]).toBe(
      '2026-11-02,PPLL,Push,Upper Chest,1,working,4,,,10,,,,,2,8,"felt ""easy"", go up\nnext time"',
    );
    expect(lines[2]).toBe('2026-11-02,,Empty workout,Pull-ups,2,warmup,,,50,8,,,,yes,,,');
    expect(lines).toHaveLength(4);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});
