import { describe, expect, it } from 'vitest';
import { calendarFile, plannedEvents } from '../../../src/domain/calendar-file';
import { CALISTHENICS_5_WEEK, PROGRAM_A } from '../../../src/domain/fixtures/templates';
import { ANCHOR, activeProgram } from './helpers';

describe('calendar reminders', () => {
  it('list the training days of a weekday program, with the week and the deload', () => {
    const { program, dayTemplates } = activeProgram(CALISTHENICS_5_WEEK);
    const events = plannedEvents({ program, days: dayTemplates, from: ANCHOR, weeks: 5 });
    expect(events).toHaveLength(20); // 4 days a week
    expect(events[0]).toEqual({
      date: '2026-11-03',
      title: 'Heavy 1, planche (intensity)',
      detail: 'Week 1 of 5. Calisthenics 5-week cycle',
    });
    const week5Tuesday = events.find((e) => e.date === '2026-12-01');
    expect(week5Tuesday?.detail).toBe('Week 5 of 5. Deload. Calisthenics 5-week cycle');
  });

  it('place a rotation on its preferred days, in order from the next workout', () => {
    const { program, dayTemplates } = activeProgram(PROGRAM_A);
    const events = plannedEvents({
      program,
      days: dayTemplates,
      from: ANCHOR,
      weeks: 1,
      nextRotationIndex: 1,
    });
    expect(events.map((e) => [e.date, e.title])).toEqual([
      ['2026-11-02', 'Lower A'],
      ['2026-11-04', 'Upper B'],
      ['2026-11-06', 'Lower B'],
    ]);
  });

  it('write an iCalendar file with an alert on each day, at the chosen local time', () => {
    const text = calendarFile({
      events: [{ date: '2026-11-03', title: 'Heavy 1, planche', detail: 'Week 1 of 5' }],
      time: '18:30',
      durationMinutes: 90,
      alertMinutes: 60,
      stamp: '20261112T090000Z',
    });
    expect(text).toContain('BEGIN:VCALENDAR\r\n');
    expect(text).toContain('DTSTART:20261103T183000\r\n');
    expect(text).toContain('DTEND:20261103T200000\r\n');
    expect(text).toContain('SUMMARY:Heavy 1\\, planche\r\n');
    expect(text).toContain('TRIGGER:-PT60M\r\n');
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});
