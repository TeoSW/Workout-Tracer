import { describe, expect, it } from 'vitest';
import {
  backupToJson,
  exportBackup,
  hasUndoSnapshot,
  recordBackup,
  restoreBackup,
  undoLastRestore,
} from '../../../src/data/backup';
import { setBodyweight } from '../../../src/data/bodyweight';
import { activateProgram, createProgramFromTemplate, getProgram } from '../../../src/data/programs';
import { startRestTimer } from '../../../src/data/rest-timer';
import { seedIfNeeded } from '../../../src/data/seed';
import { finishSession, startPlannedSession, updateSet } from '../../../src/data/sessions';
import { getSettings, setSetting } from '../../../src/data/settings';
import { listTestResults, saveTestResults } from '../../../src/data/test-results';
import { parseBackup, type BackupFile } from '../../../src/domain/backup';
import { PROGRAM_C } from '../../../src/domain/fixtures/templates';
import type { DayTemplate } from '../../../src/domain/schemas';
import { START_MS, testClock, testContext } from './helpers';

const DAY = 86_400_000;

function slotIdOf(days: DayTemplate[]): string {
  for (const d of days) for (const b of d.blocks) if (b.kind === 'choice') return b.choiceSlot.id;
  throw new Error('no choice slot');
}

/** Program C active, two finished sessions, a test day, an active session with a rest timer. */
async function realisticData(ctx = testContext()) {
  await seedIfNeeded(ctx);
  const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_C);
  await activateProgram(ctx, program.id, 'this_week');
  const day = (name: string) => dayTemplates.find((d) => d.name === name) as DayTemplate;

  const legs = await startPlannedSession(ctx, {
    programId: program.id,
    dayTemplateId: day('Heavy (planche first)').id,
  });
  for (const e of legs.exercises) {
    for (const s of e.sets)
      await updateSet(ctx, s.id, { reps: 8, rir: 2, kg: 10, done: true, note: 'ok' });
  }
  await finishSession(ctx, legs.session.id, 'Good session.');

  ctx.clock.set(START_MS + 40 * DAY);
  const test = await startPlannedSession(ctx, {
    programId: program.id,
    dayTemplateId: day('Test').id,
  });
  const hold = test.exercises.find((e) => e.exerciseId === 'planche-hold');
  await updateSet(ctx, hold?.sets[0]?.id ?? '', {
    seconds: 9,
    progressionLevel: 'Tuck',
    clean: true,
    done: true,
  });
  await finishSession(ctx, test.session.id);
  await saveTestResults(ctx, {
    sessionId: test.session.id,
    results: [
      { exerciseId: 'planche-hold', progressionLevel: 'Tuck', bestHoldSec: 9, note: 'Hips sag.' },
    ],
    choice: { slotId: slotIdOf(dayTemplates), optionIndex: 0 },
  });

  ctx.clock.set(START_MS + 42 * DAY);
  const active = await startPlannedSession(ctx, {
    programId: program.id,
    dayTemplateId: day('Legs').id,
  });
  await updateSet(ctx, active.exercises[0]?.sets[0]?.id ?? '', { kg: 15, reps: 10, done: true });
  await startRestTimer(ctx, active.session.id, 90);

  await setBodyweight(ctx, '2026-11-02', 40);
  await setBodyweight(ctx, '2026-11-20', 40.5);
  await setSetting(ctx, 'effortMode', 'rpe');
  return { ctx, program, day };
}

const tables = (b: BackupFile) => b.data;

describe('test results', () => {
  it('saves results and next cycle pick, for cycle 2 after a cycle 1 test', async () => {
    const { ctx, program } = await realisticData();
    const loaded = (await getProgram(ctx, program.id))?.dayTemplates ?? [];
    const results = await listTestResults(ctx);
    expect(results).toEqual([
      expect.objectContaining({
        exerciseId: 'planche-hold',
        date: '2026-12-12',
        bestHoldSec: 9,
        nextCycleChoice: { slotId: slotIdOf(loaded), optionIndex: 0 },
      }),
    ]);
    expect((await getProgram(ctx, program.id))?.program.choiceSelections).toEqual([
      { cycleNumber: 2, slotId: slotIdOf(loaded), optionIndex: 0 },
    ]);
  });

  it('saves a test done before week 1 for cycle 1 and replaces earlier results of the session', async () => {
    const ctx = testContext();
    await seedIfNeeded(ctx);
    const { program, dayTemplates } = await createProgramFromTemplate(ctx, PROGRAM_C);
    await activateProgram(ctx, program.id, 'next_week');
    const testDay = dayTemplates.find((d) => d.name === 'Test') as DayTemplate;
    const session = await startPlannedSession(ctx, {
      programId: program.id,
      dayTemplateId: testDay.id,
    });
    expect(session.session.cycleNumber).toBe(0);
    await finishSession(ctx, session.session.id);
    const input = {
      sessionId: session.session.id,
      results: [
        { exerciseId: 'front-lever-hold', progressionLevel: null, bestHoldSec: null, note: '' },
      ],
      choice: { slotId: slotIdOf(dayTemplates), optionIndex: 1 },
    };
    await saveTestResults(ctx, input);
    await saveTestResults(ctx, input);
    expect(await listTestResults(ctx)).toHaveLength(1);
    await expect(
      saveTestResults(ctx, { ...input, choice: { slotId: 'nope', optionIndex: 0 } }),
    ).rejects.toThrow('This program has no such choice.');
    await expect(
      saveTestResults(ctx, {
        ...input,
        choice: { slotId: slotIdOf(dayTemplates), optionIndex: 3 },
      }),
    ).rejects.toThrow('This program has no such choice.');
    expect((await getProgram(ctx, program.id))?.program.choiceSelections).toEqual([
      { cycleNumber: 1, slotId: slotIdOf(dayTemplates), optionIndex: 1 },
    ]);
  });
});

describe('acceptance 11: backup and restore', () => {
  it('restores a JSON backup into a fresh database deep-equal', async () => {
    const { ctx } = await realisticData();
    const backup = await exportBackup(ctx);
    expect(backup.data.sessions).toHaveLength(3);
    expect(backup.data.restTimer).toHaveLength(1);

    const parsed = parseBackup(JSON.parse(backupToJson(backup)));
    if (!parsed.ok) throw new Error(parsed.error);
    const fresh = testContext({ clock: testClock(START_MS + 50 * DAY) });
    await restoreBackup(fresh, parsed.backup);
    expect(tables(await exportBackup(fresh))).toEqual(tables(backup));
    expect(await getSettings(fresh)).toMatchObject({ effortMode: 'rpe' });
  });

  it('keeps the data from before a restore and can undo it', async () => {
    const { ctx } = await realisticData();
    const before = await exportBackup(ctx);
    const other = testContext();
    await seedIfNeeded(other);
    await setBodyweight(other, '2026-01-01', 80);
    const replacement = await exportBackup(other);

    expect(await hasUndoSnapshot(ctx)).toBeNull();
    await restoreBackup(ctx, replacement);
    expect(tables(await exportBackup(ctx))).toEqual(tables(replacement));
    expect(await hasUndoSnapshot(ctx)).toEqual({ createdAt: ctx.clock.now() });

    await undoLastRestore(ctx);
    expect(tables(await exportBackup(ctx))).toEqual(tables(before));
    expect(await hasUndoSnapshot(ctx)).toBeNull();
    await expect(undoLastRestore(ctx)).rejects.toThrow('There is no restore to undo.');
  });

  it('leaves the old data in place when a restore fails', async () => {
    const { ctx } = await realisticData();
    const before = await exportBackup(ctx);
    const broken = structuredClone(before);
    const firstSet = broken.data.sets[0];
    if (!firstSet) throw new Error('no sets');
    broken.data.sets.push({ ...firstSet });
    await expect(restoreBackup(ctx, broken)).rejects.toThrow();
    expect(tables(await exportBackup(ctx))).toEqual(tables(before));
    expect(await hasUndoSnapshot(ctx)).toBeNull();
  });

  it('records the last backup time', async () => {
    const ctx = testContext();
    await recordBackup(ctx);
    expect((await getSettings(ctx)).lastBackupAt).toBe(START_MS);
  });
});
