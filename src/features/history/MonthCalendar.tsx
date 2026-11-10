import { IonButton, IonIcon } from '@ionic/react';
import { chevronBack, chevronForward } from 'ionicons/icons';
import { monthGrid, type MonthStr } from '../../domain/calendar';
import type { DateStr } from '../../domain/dates';
import { formatDayLabel, formatMonth } from '../../domain/format';
import type { MissedDay, Session } from '../../domain/schemas';
import { dayTypeColor } from '../../ui/dayColors';

const WEEKDAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** More than this on one day would not fit under the number. */
const MAX_BARS = 3;

function Day(props: {
  date: DateStr;
  inMonth: boolean;
  today: boolean;
  selected: boolean;
  sessions: readonly Session[];
  missed: readonly MissedDay[];
  onTap: () => void;
}) {
  const { date, inMonth, today, selected, sessions, missed, onTap } = props;
  const named = [...sessions, ...missed.map((m) => ({ name: `missed ${m.dayName}` }))];
  if (!inMonth) return <span className="calendar-day calendar-day-outside" />;
  return (
    <button
      type="button"
      className="calendar-day"
      aria-label={formatDayLabel(date, named)}
      aria-pressed={selected}
      aria-current={today ? 'date' : undefined}
      disabled={named.length === 0}
      onClick={onTap}
    >
      <span className="calendar-number">{Number(date.slice(8))}</span>
      <span className="calendar-bars">
        {sessions.slice(0, MAX_BARS).map((session) => (
          <span
            key={session.id}
            className="calendar-bar"
            data-day-type={session.dayType}
            style={{ background: dayTypeColor(session.dayType) }}
          />
        ))}
        {sessions.length === 0 && missed.length > 0 && <span className="calendar-missed" />}
      </span>
    </button>
  );
}

/**
 * A month, Monday first. Days with workouts carry a bar in the color of their day type, and
 * missed days an outlined one.
 */
export function MonthCalendar(props: {
  month: MonthStr;
  today: DateStr;
  selected: DateStr | null;
  byDay: ReadonlyMap<DateStr, Session[]>;
  missedByDay: ReadonlyMap<DateStr, MissedDay[]>;
  canGoForward: boolean;
  onStep: (months: number) => void;
  onSelect: (date: DateStr) => void;
}) {
  const { month, today, selected, byDay, missedByDay, canGoForward, onStep, onSelect } = props;
  return (
    <div className="calendar">
      <div className="calendar-head">
        <IonButton fill="clear" aria-label="Previous month" onClick={() => onStep(-1)}>
          <IonIcon slot="icon-only" icon={chevronBack} aria-hidden="true" />
        </IonButton>
        <h2 className="calendar-title">{formatMonth(month)}</h2>
        <IonButton
          fill="clear"
          aria-label="Next month"
          disabled={!canGoForward}
          onClick={() => onStep(1)}
        >
          <IonIcon slot="icon-only" icon={chevronForward} aria-hidden="true" />
        </IonButton>
      </div>
      <div className="calendar-grid" aria-hidden="true">
        {WEEKDAY_HEADERS.map((day, i) => (
          <span key={i} className="calendar-weekday">
            {day}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {monthGrid(month)
          .flat()
          .map(({ date, inMonth }) => (
            <Day
              key={date}
              date={date}
              inMonth={inMonth}
              today={date === today}
              selected={date === selected}
              sessions={byDay.get(date) ?? []}
              missed={missedByDay.get(date) ?? []}
              onTap={() => onSelect(date)}
            />
          ))}
      </div>
    </div>
  );
}
