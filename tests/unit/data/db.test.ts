import { describe, expect, it } from 'vitest';
import { clean } from '../../../src/data/clean';
import { BACKUP_TABLES, DB_SCHEMA_VERSION } from '../../../src/data/db';
import { BACKUP_SCHEMA_VERSION, emptyBackupData } from '../../../src/domain/backup';
import { SEED_BANDS } from '../../../src/domain/fixtures/bands';
import { reopen, testContext } from './helpers';

describe('clean', () => {
  it('drops undefined properties deeply and keeps every other value', () => {
    const input = {
      a: undefined,
      b: null,
      c: 0,
      d: false,
      e: [],
      f: { g: undefined, h: [{ i: undefined, j: 1 }] },
      k: '',
    };
    const output = clean(input);
    expect(output).toEqual({ b: null, c: 0, d: false, e: [], f: { h: [{ j: 1 }] }, k: '' });
    expect('a' in output).toBe(false);
    expect('g' in output.f).toBe(false);
    expect(input).toHaveProperty('a');
  });

  it('makes a record equal to its JSON round trip', () => {
    const record = { id: 'x', nested: { maybe: undefined, list: [1, 2] } };
    expect(clean(record)).toStrictEqual(JSON.parse(JSON.stringify(record)));
  });
});

describe('database', () => {
  it('keeps the Dexie and backup schema versions in step', () => {
    expect(DB_SCHEMA_VERSION).toBe(BACKUP_SCHEMA_VERSION);
  });

  it('backs up every table except snapshots', () => {
    const ctx = testContext();
    const tables = ctx.db.tables.map((t) => t.name).sort();
    expect(tables).toEqual([...BACKUP_TABLES, 'snapshots'].sort());
    expect([...BACKUP_TABLES].sort()).toEqual(Object.keys(emptyBackupData()).sort());
  });

  it('keeps data across a reopen and isolates test contexts', async () => {
    const ctx = testContext();
    await ctx.db.bands.bulkPut(SEED_BANDS);
    const again = reopen(ctx);
    expect(await again.db.bands.count()).toBe(4);
    expect(await testContext().db.bands.count()).toBe(0);
  });
});
