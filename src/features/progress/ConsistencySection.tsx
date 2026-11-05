import { averageDuration, consistencyWeeks, weekStreak } from '../../domain/consistency';
import type { DateStr } from '../../domain/dates';
import { formatDuration, formatShortDate } from '../../domain/format';
import type { Program, Session } from '../../domain/schemas';
import { ChartCard } from '../../ui/ChartCard';
import { WeekBars } from '../../ui/charts/WeekBars';

function readout(
  streak: number,
  week: { planned: number | null; finished: number } | undefined,
  average: number | null,
): string {
  const parts = [`${streak} week streak`];
  if (week) {
    const planned = week.planned === null ? '' : ` of ${week.planned}`;
    parts.push(`this week ${week.finished}${planned}`);
  }
  if (average !== null) parts.push(`average ${formatDuration(average)}`);
  return parts.join(', ');
}

export function ConsistencySection(props: {
  sessions: readonly Session[];
  program: Program | null;
  today: DateStr;
}) {
  const { sessions, program, today } = props;
  const weeks = consistencyWeeks({ sessions, program, today });
  const streak = weekStreak(
    sessions.map((s) => s.date),
    today,
  );
  return (
    <ChartCard
      title="Consistency"
      readout={readout(streak, weeks.at(-1), averageDuration(sessions, today))}
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
