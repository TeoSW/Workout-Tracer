import { describe, expect, it } from 'vitest';
import {
  activateProgram,
  addDayTemplate,
  archiveProgram,
  createProgramFromTemplate,
  deleteDayTemplate,
  deleteProgram,
  editDayTemplate,
  editProgram,
  getActiveProgram,
  getProgram,
  listPrograms,
  removeDeloadThisWeek,
  saveDayTemplate,
  setProgramCurrentWeek,
  setDeloadThisWeek,
  updateProgram,
} from '../../../src/data/programs';
import { PROGRAM_A, PROGRAM_B, PROGRAM_C } from '../../../src/domain/fixtures/templates';
import { cyclePosition } from '../../../src/domain/schedule';
import { testContext } from './helpers';

// The test clock starts on Monday 2026-11-02.

describe('programs', () => {
  it('creates a program from a template with its day templates in schedule order', async () => {
    const ctx = testContext();
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_C);
    const loaded = await getProgram(ctx, program.id);
    expect(loaded?.program).toEqual(program);
    expect(loaded?.dayTemplates.map((d) => d.name)).toEqual([
      'Heavy (planche first)',
      'Light (front lever first)',
      'Heavy (front lever first)',
      'Light (planche first)',
      'Legs',
      'Dynamics',
      'Test',
    ]);
    const renamed = await createProgramFromTemplate(ctx, PROGRAM_A, 'Mine');
    expect(renamed.program.name).toBe('Mine');
  });

  it('keeps one active program and anchors it on this or next Monday', async () => {
    const ctx = testContext();
    ctx.clock.set(Date.parse('2026-11-05T09:00:00')); // Thursday
    const a = (await createProgramFromTemplate(ctx, PROGRAM_A)).program;
    const c = (await createProgramFromTemplate(ctx, PROGRAM_C)).program;
    await activateProgram(ctx, a.id, 'this_week');
    expect((await getActiveProgram(ctx))?.anchorDate).toBe('2026-11-02');
    await activateProgram(ctx, c.id, 'next_week');
    const active = await getActiveProgram(ctx);
    expect(active).toMatchObject({ id: c.id, anchorDate: '2026-11-09' });
    expect((await getProgram(ctx, a.id))?.program.active).toBe(false);
    expect((await listPrograms(ctx)).map((p) => p.id)).toEqual([c.id, a.id]);
  });

  it('sets the current week and deloads only this week', async () => {
    const ctx = testContext();
    const c = (await createProgramFromTemplate(ctx, PROGRAM_C)).program;
    await activateProgram(ctx, c.id, 'this_week');
    const moved = await setProgramCurrentWeek(ctx, c.id, 4);
    expect(cyclePosition(moved, ctx.clock.today())).toMatchObject({ cycleWeek: 4 });
    const deloaded = await setDeloadThisWeek(ctx, c.id);
    expect(deloaded.manualDeloadWeeks).toEqual(['2026-11-02']);
    expect((await removeDeloadThisWeek(ctx, c.id)).manualDeloadWeeks).toEqual([]);
  });

  it('validates program edits', async () => {
    const ctx = testContext();
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_C);
    await expect(updateProgram(ctx, { ...program, cycleWeeks: 4 })).rejects.toThrow();
    await expect(
      updateProgram(ctx, {
        ...program,
        schedule: { kind: 'rotation', sequence: ['nope'], sessionsPerWeek: 3 },
        cycleWeeks: null,
        deloadWeeks: [],
      }),
    ).rejects.toThrow('The schedule points at a day that is not in this program.');
    const saved = await updateProgram(ctx, { ...program, name: 'Calisthenics' });
    expect(saved.name).toBe('Calisthenics');
  });

  it('adds, edits and deletes day templates, clearing them from the schedule', async () => {
    const ctx = testContext();
    const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_B);
    const extra = await addDayTemplate(ctx, program.id, { name: 'Arms', dayType: 'hypertrophy' });
    expect(extra).toMatchObject({ programId: program.id, blocks: [], deloadExempt: false });
    await saveDayTemplate(ctx, { ...extra, note: 'Short day.' });
    expect(
      (await getProgram(ctx, program.id))?.dayTemplates.find((d) => d.id === extra.id)?.note,
    ).toBe('Short day.');

    const legs = dayTemplates.find((d) => d.name === 'Legs');
    if (!legs) throw new Error('missing Legs');
    await deleteDayTemplate(ctx, legs.id);
    const after = await getProgram(ctx, program.id);
    if (after?.program.schedule.kind !== 'weekday') throw new Error('expected weekday grid');
    expect(after.program.schedule.weeks[0]).toMatchObject({ tue: null, fri: null });
    await expect(saveDayTemplate(ctx, { ...extra, programId: 'missing' })).rejects.toThrow();
  });

  it('refuses to delete the last day of a rotation', async () => {
    const ctx = testContext();
    const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_A);
    for (const day of dayTemplates.slice(1)) await deleteDayTemplate(ctx, day.id);
    const after = await getProgram(ctx, program.id);
    expect(after?.program.schedule).toMatchObject({ sequence: [dayTemplates[0]?.id] });
    await expect(deleteDayTemplate(ctx, dayTemplates[0]?.id ?? '')).rejects.toThrow(
      'A rotation needs at least one day.',
    );
  });

  it('archives and deletes programs', async () => {
    const ctx = testContext();
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_A);
    await activateProgram(ctx, program.id, 'this_week');
    await archiveProgram(ctx, program.id);
    expect(await getActiveProgram(ctx)).toBeUndefined();
    expect(await listPrograms(ctx)).toEqual([]);
    expect(await listPrograms(ctx, { includeArchived: true })).toHaveLength(1);
    await deleteProgram(ctx, program.id);
    expect(await getProgram(ctx, program.id)).toBeUndefined();
    expect(await ctx.db.dayTemplates.count()).toBe(0);
  });
});

describe('editing at the same time', () => {
  it('keeps both of two day edits made in a row', async () => {
    const ctx = testContext();
    const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_B);
    const day = dayTemplates[0];
    if (!day) throw new Error('missing day');
    await Promise.all([
      editDayTemplate(ctx, day.id, (d) => ({ ...d, note: 'First.' })),
      editDayTemplate(ctx, day.id, (d) => ({ ...d, name: 'Second' })),
    ]);
    const loaded = (await getProgram(ctx, program.id))?.dayTemplates.find((d) => d.id === day.id);
    expect(loaded).toMatchObject({ note: 'First.', name: 'Second' });
  });

  it('keeps both of two program edits made in a row', async () => {
    const ctx = testContext();
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_B);
    await Promise.all([
      editProgram(ctx, program.id, (p) => ({ ...p, note: 'First.' })),
      editProgram(ctx, program.id, (p) => ({ ...p, name: 'Second' })),
    ]);
    expect((await getProgram(ctx, program.id))?.program).toMatchObject({
      note: 'First.',
      name: 'Second',
    });
  });

  it('refuses an edit that breaks the program rules and keeps the old data', async () => {
    const ctx = testContext();
    const { program } = await createProgramFromTemplate(ctx, PROGRAM_C);
    await expect(editProgram(ctx, program.id, (p) => ({ ...p, cycleWeeks: 4 }))).rejects.toThrow();
    expect((await getProgram(ctx, program.id))?.program.cycleWeeks).toBe(6);
  });
});
