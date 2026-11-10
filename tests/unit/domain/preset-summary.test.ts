import { describe, expect, it } from 'vitest';
import {
  BEGINNER_CALISTHENICS,
  BUILT_IN_TEMPLATES,
  CALISTHENICS_5_WEEK,
  PROGRAM_B,
} from '../../../src/domain/fixtures/templates';
import { presetSummary, presetWeeks } from '../../../src/domain/preset-summary';

describe('preset previews', () => {
  it('sum a preset up in one line', () => {
    expect(presetSummary(CALISTHENICS_5_WEEK)).toBe(
      '5-week cycle, 4 days a week, deload in week 5',
    );
    expect(presetSummary(BEGINNER_CALISTHENICS)).toBe('Rotation, 3 days a week');
    expect(presetSummary(PROGRAM_B)).toBe('Weekly, 4 days a week');
  });

  it('fold weeks in a row that are the same', () => {
    expect(presetWeeks(CALISTHENICS_5_WEEK).map((w) => w.label)).toEqual([
      'Weeks 1-2',
      'Weeks 3-4',
      'Week 5',
    ]);
    expect(presetWeeks(CALISTHENICS_5_WEEK)[2]?.days).toEqual([
      { weekday: 'tue', dayName: 'Heavy 1, planche (volume)' },
      { weekday: 'thu', dayName: 'Light' },
      { weekday: 'sat', dayName: 'Test' },
      { weekday: 'sun', dayName: 'Legs' },
    ]);
    expect(presetWeeks(PROGRAM_B).map((w) => w.label)).toEqual(['Every week']);
    expect(presetWeeks(BEGINNER_CALISTHENICS)).toEqual([]);
  });

  it('work for every built-in preset', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(presetSummary(t)).not.toBe('');
      if (t.schedule.kind === 'weekday') {
        const covered = presetWeeks(t).reduce((n, w) => {
          const m = /Weeks? (\d+)(?:-(\d+))?/.exec(w.label);
          return (
            n +
            (m ? Number(m[2] ?? m[1]) - Number(m[1]) + 1 : t.schedule.kind === 'weekday' ? 1 : 0)
          );
        }, 0);
        expect(covered).toBe(t.schedule.weeks.length);
      }
    }
  });
});
