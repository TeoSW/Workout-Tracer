import { describe, expect, it } from 'vitest';
import { backupDue } from '../../../src/domain/backup';

const at = (dateTime: string) => Date.parse(dateTime);
const base = {
  lastBackupAt: at('2026-11-01T22:00:00'),
  reminderDays: 14,
  firstFinishedDate: '2026-09-01',
};

describe('backup reminder', () => {
  it('stays quiet until the interval has passed', () => {
    expect(backupDue({ ...base, today: '2026-11-14' })).toBe(false);
  });

  it('falls due on the exact day, whatever the hour of the backup', () => {
    expect(backupDue({ ...base, today: '2026-11-15' })).toBe(true);
    expect(
      backupDue({ ...base, lastBackupAt: at('2026-11-01T00:10:00'), today: '2026-11-15' }),
    ).toBe(true);
  });

  it('counts calendar days across the clock changes', () => {
    const spring = { ...base, lastBackupAt: at('2026-03-20T12:00:00') };
    expect(backupDue({ ...spring, today: '2026-04-02' })).toBe(false);
    expect(backupDue({ ...spring, today: '2026-04-03' })).toBe(true);
    const autumn = { ...base, lastBackupAt: at('2026-10-20T12:00:00') };
    expect(backupDue({ ...autumn, today: '2026-11-02' })).toBe(false);
    expect(backupDue({ ...autumn, today: '2026-11-03' })).toBe(true);
  });

  it('says nothing to someone with no backup and nothing to lose', () => {
    expect(
      backupDue({ ...base, lastBackupAt: null, firstFinishedDate: null, today: '2026-11-15' }),
    ).toBe(false);
  });

  it('counts from the first finished workout when there is no backup yet', () => {
    const fresh = { ...base, lastBackupAt: null, firstFinishedDate: '2026-11-01' };
    expect(backupDue({ ...fresh, today: '2026-11-14' })).toBe(false);
    expect(backupDue({ ...fresh, today: '2026-11-15' })).toBe(true);
  });

  it('stays quiet when the backup is dated after today, as after a clock change on the phone', () => {
    expect(backupDue({ ...base, today: '2026-10-01' })).toBe(false);
  });

  it('follows a shorter interval', () => {
    expect(backupDue({ ...base, reminderDays: 1, today: '2026-11-02' })).toBe(true);
  });
});
