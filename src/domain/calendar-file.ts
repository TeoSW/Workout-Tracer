import { addDays, weekdayOf, type DateStr, type Weekday } from './dates';
import { isDeloadDay } from './deload';
import { cyclePosition, plannedDayTemplateId } from './schedule';
import type { DayTemplate, Program } from './schemas';

export type CalendarEvent = { date: DateStr; title: string; detail: string };

const DEFAULT_ROTATION_DAYS: readonly Weekday[] = ['mon', 'wed', 'fri'];

/**
 * The training days of the next `weeks` weeks from `from` (inclusive). Weekday programs use
 * their grid; rotations use their preferred weekdays, in rotation order from the next day.
 */
export function plannedEvents(input: {
  program: Program;
  days: readonly DayTemplate[];
  from: DateStr;
  weeks: number;
  /** Rotation position of the next workout, for rotations. */
  nextRotationIndex?: number;
}): CalendarEvent[] {
  const { program, days, from, weeks } = input;
  const nameOf = (id: string) => days.find((d) => d.id === id)?.name ?? 'Workout';
  const events: CalendarEvent[] = [];
  const total = weeks * 7;

  if (program.schedule.kind === 'weekday') {
    for (let i = 0; i < total; i++) {
      const date = addDays(from, i);
      const id = plannedDayTemplateId(program, date);
      if (id === null) continue;
      const day = days.find((d) => d.id === id);
      const position = cyclePosition(program, date);
      const week =
        position && program.cycleWeeks !== null && program.cycleWeeks > 1
          ? `Week ${position.cycleWeek} of ${program.cycleWeeks}`
          : '';
      const deload = day !== undefined && isDeloadDay(program, day, date) ? 'Deload' : '';
      events.push({
        date,
        title: nameOf(id),
        detail: [week, deload, program.name].filter((p) => p !== '').join('. '),
      });
    }
    return events;
  }

  const sequence = program.schedule.sequence;
  const preferred = program.schedule.preferredWeekdays ?? DEFAULT_ROTATION_DAYS;
  const trainingDays = new Set(preferred);
  let index = input.nextRotationIndex ?? 0;
  for (let i = 0; i < total; i++) {
    const date = addDays(from, i);
    if (!trainingDays.has(weekdayOf(date))) continue;
    const id = sequence[index % sequence.length];
    index += 1;
    if (id === undefined) continue;
    events.push({ date, title: nameOf(id), detail: program.name });
  }
  return events;
}

/** Text in an iCalendar field: backslash, comma, semicolon and line breaks escaped. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const compactDate = (date: DateStr) => date.replace(/-/g, '');

/**
 * An iCalendar file with one event per training day at `time` (HH:mm, the phone's local time),
 * each with an alert `alertMinutes` before. Calendar apps then remind you with the app closed.
 */
export function calendarFile(input: {
  events: readonly CalendarEvent[];
  time: string;
  durationMinutes: number;
  alertMinutes: number;
  stamp: string;
}): string {
  const [hours = '18', minutes = '00'] = input.time.split(':');
  const start = `${hours.padStart(2, '0')}${minutes.padStart(2, '0')}00`;
  const startMinutes = Number(hours) * 60 + Number(minutes);
  const endMinutes = Math.min(startMinutes + input.durationMinutes, 23 * 60 + 59);
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}${String(endMinutes % 60).padStart(2, '0')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Workout Tracker//EN',
    'CALSCALE:GREGORIAN',
    ...input.events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${compactDate(e.date)}-${escapeText(e.title).replace(/[^A-Za-z0-9]/g, '')}@workout-tracker`,
      `DTSTAMP:${input.stamp}`,
      `DTSTART:${compactDate(e.date)}T${start}`,
      `DTEND:${compactDate(e.date)}T${end}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.detail)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Training today: ${e.title}`)}`,
      `TRIGGER:-PT${Math.max(0, Math.round(input.alertMinutes))}M`,
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}
