import { describe, expect, it } from 'vitest';
import { addBand } from '../../../src/data/bands';
import { exportCsv } from '../../../src/data/csv';
import { addCustomExercise, listExercises } from '../../../src/data/exercises';
import {
  createProgramFromTemplate,
  getProgram,
  listPrograms,
  saveDayTemplate,
} from '../../../src/data/programs';
import { seedIfNeeded } from '../../../src/data/seed';
import {
  addExercise,
  finishSession,
  startEmptySession,
  startPlannedSession,
  updateSet,
} from '../../../src/data/sessions';
import { importProgram, previewImport, shareProgram } from '../../../src/data/share';
import { CSV_HEADER } from '../../../src/domain/csv';
import { BUILT_IN_TEMPLATES, PROGRAM_A, PROGRAM_B } from '../../../src/domain/fixtures/templates';
import type { Block, DayTemplate } from '../../../src/domain/schemas';
import { testContext } from './helpers';

async function seeded(idPrefix: string) {
  const ctx = testContext({ idPrefix });
  await seedIfNeeded(ctx);
  return ctx;
}

const shape = (days: DayTemplate[]) =>
  days.map((d) => ({
    name: d.name,
    dayType: d.dayType,
    blocks: d.blocks.map((b: Block) =>
      b.kind === 'exercise'
        ? [b.exerciseId, b.setsMin, b.target]
        : b.choiceSlot.options.map((o) => o.exerciseId),
    ),
  }));

describe('CSV export', () => {
  it('writes one row per done set of finished sessions', async () => {
    const ctx = await seeded('c');
    const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_B);
    const push = dayTemplates.find((d) => d.name === 'Push') as DayTemplate;
    const view = await startPlannedSession(ctx, { programId: program.id, dayTemplateId: push.id });
    const chest = view.exercises[0];
    await updateSet(ctx, chest?.sets[0]?.id ?? '', { kg: 4, reps: 10, rir: 2, done: true });
    await updateSet(ctx, chest?.sets[1]?.id ?? '', {
      kg: 4,
      reps: 9,
      rir: 1,
      done: true,
      note: 'last, hard',
    });
    await finishSession(ctx, view.session.id);

    ctx.clock.advance(3_600_000);
    const empty = await startEmptySession(ctx);
    const pullUps = await addExercise(ctx, empty.session.id, 'pull-ups');
    await updateSet(ctx, pullUps.sets[0]?.id ?? '', {
      reps: 10,
      bandIds: ['band-35', 'band-15'],
      done: true,
    });
    await finishSession(ctx, empty.session.id);

    const active = await startEmptySession(ctx);
    const squat = await addExercise(ctx, active.session.id, 'squat');
    await updateSet(ctx, squat.sets[0]?.id ?? '', { kg: 20, reps: 5, done: true });

    const lines = (await exportCsv(ctx)).trimEnd().split('\r\n');
    expect(lines).toEqual([
      CSV_HEADER.join(','),
      '2026-11-02,PPLL,Push,Upper Chest,1,working,4,,,10,,,,,2,8,',
      '2026-11-02,PPLL,Push,Upper Chest,2,working,4,,,9,,,,,1,9,"last, hard"',
      '2026-11-02,,Empty workout,Pull-ups,1,working,,,50,10,,,,,,,',
    ]);
  });
});

describe('acceptance 12: program share and import', () => {
  it('round trips every built-in template into a fresh database with fresh ids', async () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const sender = await seeded('s');
      const receiver = await seeded('r');
      const { program } = await createProgramFromTemplate(sender, template);
      const original = await getProgram(sender, program.id);
      const { code } = await shareProgram(sender, program.id);

      const imported = await importProgram(receiver, code);
      if (!imported.ok) throw new Error(imported.error);
      const copy = await getProgram(receiver, imported.program.id);
      if (!original || !copy) throw new Error('missing program');
      expect(copy.program.name).toBe(template.name);
      expect(copy.program.id).not.toBe(original.program.id);
      expect(copy.dayTemplates.map((d) => d.id)).not.toContain(original.dayTemplates[0]?.id);
      expect(shape(copy.dayTemplates)).toEqual(shape(original.dayTemplates));
      expect(copy.program).toMatchObject({
        active: false,
        anchorDate: null,
        cycleWeeks: template.cycleWeeks,
      });
      expect(await receiver.db.exercises.count()).toBe(60);
    }
  });

  it('reuses exercises by name in any case, creates custom bands once, and renames on a clash', async () => {
    const sender = await seeded('s');
    const receiver = await seeded('r');
    const base = {
      trackingType: 'bodyweight_reps' as const,
      primaryMuscles: ['upper_back' as const],
      secondaryMuscles: [],
      unilateral: false,
      loadUnit: 'total' as const,
      defaultRestSec: 90,
      cues: '',
      alternativeIds: [],
    };
    const ring = await addCustomExercise(sender, { ...base, name: 'Ring Row' });
    const mine = await addCustomExercise(receiver, { ...base, name: 'RING ROW' });
    const thin = await addBand(sender, { label: 'Thin', ratedKg: 3 });
    const { program, dayTemplates } = await createProgramFromTemplate(sender, PROGRAM_A);
    const upperA = dayTemplates[0] as DayTemplate;
    await saveDayTemplate(sender, {
      ...upperA,
      blocks: [
        ...upperA.blocks,
        {
          kind: 'exercise',
          id: 'ring',
          order: 9,
          exerciseId: ring.id,
          setsMin: 2,
          target: { bandIds: [thin.id] },
          warmupSets: 0,
        },
        {
          kind: 'exercise',
          id: 'ring2',
          order: 10,
          exerciseId: ring.id,
          setsMin: 1,
          target: { bandIds: [thin.id] },
          warmupSets: 0,
        },
      ],
    });
    const { code } = await shareProgram(sender, program.id);

    const preview = await previewImport(receiver, code);
    if (!preview.ok) throw new Error(preview.error);
    expect(preview.plan.newExercises).toEqual([]);
    expect(preview.plan.newBands.map((b) => b.label)).toEqual(['Thin']);
    expect(await listPrograms(receiver)).toEqual([]);

    const first = await importProgram(receiver, code);
    const second = await importProgram(receiver, code);
    if (!first.ok || !second.ok) throw new Error('import failed');
    expect([first.program.name, second.program.name]).toEqual(['ULU/LUL', 'ULU/LUL (2)']);
    const copy = await getProgram(receiver, first.program.id);
    const added = copy?.dayTemplates[0]?.blocks.slice(-2) ?? [];
    expect(added.map((b) => (b.kind === 'exercise' ? b.exerciseId : null))).toEqual([
      mine.id,
      mine.id,
    ]);
    const bands = await receiver.db.bands.toArray();
    expect(bands.filter((b) => b.ratedKg === 3)).toHaveLength(1);
    expect(added[0]?.target.bandIds).toEqual([bands.find((b) => b.ratedKg === 3)?.id]);
    expect((await listExercises(receiver)).filter((e) => e.isCustom)).toHaveLength(1);
  });

  it('reports a bad code without writing anything', async () => {
    const receiver = await seeded('r');
    expect(await importProgram(receiver, 'WT1.nope')).toEqual({
      ok: false,
      error: 'This share code is damaged.',
    });
    expect(await receiver.db.programs.count()).toBe(0);
  });
});

describe('import review fixes', () => {
  it('names two imports started together distinctly', async () => {
    const sender = await seeded('s');
    const receiver = await seeded('r');
    const { program } = await createProgramFromTemplate(sender, PROGRAM_A);
    const { code } = await shareProgram(sender, program.id);
    const results = await Promise.all([
      importProgram(receiver, code),
      importProgram(receiver, code),
    ]);
    const names = results.map((r) => (r.ok ? r.program.name : r.error)).sort();
    expect(names).toEqual(['ULU/LUL', 'ULU/LUL (2)']);
  });
});
