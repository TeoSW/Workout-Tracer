import { describe, expect, it } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  createBackup,
  emptyBackupData,
  parseBackup,
  recordCounts,
} from '../../../src/domain/backup';
import { fromBase64Url, toBase64Url } from '../../../src/domain/base64url';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { SEED_EXERCISES } from '../../../src/domain/fixtures/exercises';
import {
  BUILT_IN_TEMPLATES,
  PROGRAM_A,
  blankTemplate,
} from '../../../src/domain/fixtures/templates';
import { SPLIT_TYPES, type Exercise } from '../../../src/domain/schemas';
import { buildProgramShare, encodeShareCode, parseShareInput } from '../../../src/domain/share';
import { instantiateTemplate } from '../../../src/domain/templates';
import { counterIds, makeSession, makeSet } from './helpers';

const exercisesById = new Map(SEED_EXERCISES.map((e) => [e.id, e]));

describe('base64url', () => {
  it('round trips random bytes of every length', () => {
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) % 256;
    for (let length = 0; length < 70; length++) {
      const bytes = Uint8Array.from({ length }, next);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
  });

  it('matches known vectors without padding', () => {
    const enc = (s: string) => toBase64Url(new TextEncoder().encode(s));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('Zg');
    expect(enc('fo')).toBe('Zm8');
    expect(enc('foo')).toBe('Zm9v');
    expect(toBase64Url(Uint8Array.from([0xfb, 0xff, 0xbf]))).toBe('-_-_');
  });

  it('rejects characters outside the alphabet', () => {
    expect(() => fromBase64Url('ab+c')).toThrow();
    expect(() => fromBase64Url('a')).toThrow();
  });
});

describe('backup file', () => {
  const session = makeSession({ date: '2026-11-02' });
  const data = {
    ...emptyBackupData(),
    exercises: SEED_EXERCISES,
    bands: SEED_BANDS,
    sessions: [session],
    sets: [makeSet({ sessionId: session.id, exerciseId: 'squat', kg: 20, reps: 10, rir: 2 })],
    bodyweight: [{ date: '2026-11-02', kg: 40 }],
    settings: [{ key: 'effortMode', value: 'rpe' }],
  };
  const backup = createBackup(data, 1_700_000_000_000);

  it('round trips through JSON', () => {
    const parsed = parseBackup(JSON.parse(JSON.stringify(backup)));
    expect(parsed).toEqual({ ok: true, backup });
    expect(backup).toMatchObject({ app: 'workout-tracker', schemaVersion: BACKUP_SCHEMA_VERSION });
  });

  it('counts records per table', () => {
    expect(recordCounts(backup)).toMatchObject({
      exercises: 54,
      bands: 3,
      sessions: 1,
      sets: 1,
      programs: 0,
    });
  });

  it('names the file by date', () => {
    expect(backupFileName('2026-10-30')).toBe('workout-tracker-backup-2026-10-30.json');
  });

  it('rejects other files with a readable error', () => {
    expect(parseBackup({ app: 'something-else', schemaVersion: 1 })).toEqual({
      ok: false,
      error: 'This is not a Workout Tracker backup.',
    });
    expect(parseBackup('nope')).toMatchObject({ ok: false });
    expect(parseBackup({ ...backup, schemaVersion: BACKUP_SCHEMA_VERSION + 1 })).toEqual({
      ok: false,
      error: 'This backup comes from a newer version of the app. Update the app, then try again.',
    });
    const broken = { ...backup, data: { ...backup.data, sets: [{ id: 'x' }] } };
    const result = parseBackup(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^The backup file is damaged: data\.sets\.0/);
  });

  it('runs migrations in order from older schema versions', () => {
    const old = { app: 'workout-tracker', schemaVersion: -1, exportedAt: 1, legacy: true };
    const calls: number[] = [];
    const result = parseBackup(old, {
      [-1]: (file) => {
        calls.push(-1);
        return { ...file, schemaVersion: 0 };
      },
      0: (file) => {
        calls.push(0);
        return { ...file, schemaVersion: 1, data: emptyBackupData(), legacy: undefined };
      },
    });
    expect(calls).toEqual([-1, 0]);
    expect(result.ok).toBe(true);
    expect(parseBackup({ ...old, schemaVersion: 0 })).toEqual({
      ok: false,
      error: 'This backup uses an old format the app cannot read.',
    });
  });
});

describe('program share codec', () => {
  const templates = [...BUILT_IN_TEMPLATES, ...SPLIT_TYPES.map(blankTemplate)];

  it('acceptance 12 (codec): round trips every built-in template through a share code', () => {
    for (const template of templates) {
      const { program, dayTemplates } = instantiateTemplate(template, { newId: counterIds('s') });
      const share = buildProgramShare(
        { ...program, active: true, anchorDate: '2026-11-02' },
        dayTemplates,
        exercisesById,
      );
      const code = encodeShareCode(share);
      expect(code.startsWith('WT1.')).toBe(true);
      expect(code).toMatch(/^WT1\.[A-Za-z0-9_-]+$/);
      expect(parseShareInput(code)).toEqual({ ok: true, share });
      expect(parseShareInput(JSON.stringify(share, null, 2))).toEqual({ ok: true, share });
    }
  });

  it('strips per-user state and includes only custom exercises', () => {
    const { program, dayTemplates } = instantiateTemplate(PROGRAM_A, { newId: counterIds('s') });
    const base = SEED_EXERCISES[0];
    const firstDay = dayTemplates[0];
    if (!base || !firstDay) throw new Error('missing fixtures');
    const custom: Exercise = { ...base, id: 'my-row', name: 'My Row', isCustom: true };
    firstDay.blocks.push({
      kind: 'exercise',
      id: 'extra',
      order: 9,
      exerciseId: 'my-row',
      setsMin: 2,
      target: {},
      warmupSets: 0,
    });
    const share = buildProgramShare(
      {
        ...program,
        active: true,
        anchorDate: '2026-11-02',
        manualDeloadWeeks: ['2026-11-09'],
        choiceSelections: [{ cycleNumber: 1, slotId: 'x', optionIndex: 0 }],
      },
      dayTemplates,
      new Map([...exercisesById, ['my-row', custom]]),
    );
    expect(share).toMatchObject({ app: 'workout-tracker', kind: 'program', schemaVersion: 1 });
    expect(share.program).toMatchObject({
      active: false,
      anchorDate: null,
      manualDeloadWeeks: [],
      choiceSelections: [],
    });
    expect(share.exercises).toEqual([custom]);
  });

  it('tolerates whitespace and line breaks in a pasted code', () => {
    const { program, dayTemplates } = instantiateTemplate(PROGRAM_A, { newId: counterIds('s') });
    const code = encodeShareCode(buildProgramShare(program, dayTemplates, exercisesById));
    const pasted = `  ${code.slice(0, 40)}\n${code.slice(40, 90)} \r\n${code.slice(90)}  `;
    expect(parseShareInput(pasted).ok).toBe(true);
  });

  it('gives readable errors for bad input', () => {
    expect(parseShareInput('hello')).toEqual({
      ok: false,
      error: 'Paste a share code that starts with WT1. or a program file.',
    });
    expect(parseShareInput('WT1.***')).toEqual({ ok: false, error: 'This share code is damaged.' });
    expect(parseShareInput('WT1.AAAA')).toEqual({
      ok: false,
      error: 'This share code is damaged.',
    });
    expect(parseShareInput('{ not json')).toEqual({
      ok: false,
      error: 'This file is not valid JSON.',
    });
    expect(parseShareInput('{"app":"workout-tracker","kind":"backup"}')).toEqual({
      ok: false,
      error: 'This is not a Workout Tracker program.',
    });
  });
});
