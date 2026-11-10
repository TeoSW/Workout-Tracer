import { averageDuration, consistencyWeeks, weekStreak } from '../../domain/consistency';
import type { DateStr } from '../../domain/dates';
import { formatDuration, formatShortDate } from '../../domain/format';
import { monthOf } from '../../domain/calendar';
import { missedDaysInMonth } from '../../domain/missed-days';
import type { MissedDay, Program, Session } from '../../domain/schemas';
import { ChartCard } from '../../ui/ChartCard';
import { WeekBars } from '../../ui/charts/WeekBars';

function readout(
  streak: number,
  week: { planned: number | null; finished: number } | undefined,
  average: number | null,
  missed: { total: number; marked: number } | null,
): string {
  const parts = [`${streak} week streak`];
  if (week) {
    const planned = week.planned === null ? '' : ` of ${week.planned}`;
    parts.push(`this week ${week.finished}${planned}`);
  }
  if (average !== null) parts.push(`average ${formatDuration(average)}`);
  if (missed !== null) {
    const marked = missed.marked > 0 ? ` (${missed.marked} marked)` : '';
    parts.push(`missed this month ${missed.total}${marked}`);
  }
  return parts.join(', ');
}

export function ConsistencySection(props: {
  sessions: readonly Session[];
  program: Program | null;
  missedDays: readonly MissedDay[];
  today: DateStr;
}) {
  const { sessions, program, missedDays, today } = props;
  const missed = program
    ? missedDaysInMonth({ program, sessions, missedDays, month: monthOf(today), today })
    : null;
  const weeks = consistencyWeeks({ sessions, program, today });
  const streak = weekStreak(
    sessions.map((s) => s.date),
    today,
  );
  return (
    <ChartCard
      title="Consistency"
      readout={readout(streak, weeks.at(-1), averageDuration(sessions, today), missed)}
    >
      <WeekBars
        rows={weeks.map((w) => ({
          label: formatShortDate(w.weekStart),
          planned: w.planned,
          finished: w.finished,
        }))}
      />
    </ChartCard>
  );
}
