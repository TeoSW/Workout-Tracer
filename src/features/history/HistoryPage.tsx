import { IonItem, IonLabel, IonList, IonNote } from '@ionic/react';
import { useState } from 'react';
import { useLive, useToday } from '../../app/DataProvider';
import { hasFinishedSession, sessionsInMonth } from '../../data/history';
import { dayTypesIn, monthOf, sessionsByDay, stepMonth } from '../../domain/calendar';
import { sessionDurationMs } from '../../domain/consistency';
import type { DateStr } from '../../domain/dates';
import { formatDuration, formatMonth, formatShortDate } from '../../domain/format';
import type { Session } from '../../domain/schemas';
import { dayTypeColor } from '../../ui/dayColors';
import { DAY_TYPE_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { MonthCalendar } from './MonthCalendar';

function SessionRow({ session }: { session: Session }) {
  const duration = sessionDurationMs(session);
  const detail = [
    formatShortDate(session.date),
    DAY_TYPE_LABELS[session.dayType],
    ...(duration === null ? [] : [formatDuration(duration)]),
  ].join(' · ');
  return (
    <IonItem routerLink={`/tabs/history/${session.id}`} detail>
      <span
        slot="start"
        className="day-dot"
        style={{ background: dayTypeColor(session.dayType) }}
      />
      <IonLabel>
        <h2>{session.name}</h2>
        <p>{detail}</p>
      </IonLabel>
    </IonItem>
  );
}

export function HistoryPage() {
  const today = useToday();
  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState<DateStr | null>(null);
  const sessions = useLive((c) => sessionsInMonth(c, month), [month]);
  const anyFinished = useLive(hasFinishedSession);

  const byDay = sessionsByDay(sessions ?? []);
  // A deleted session can leave the picked day empty, and an empty day can't be tapped off.
  const day = selected !== null && byDay.has(selected) ? selected : null;
  const listed = day === null ? (sessions ?? []) : (byDay.get(day) ?? []);
  const newestFirst = [...listed].sort((a, b) => b.startedAt - a.startedAt);
  const legend = dayTypesIn(sessions ?? []);

  function step(months: number) {
    setMonth(stepMonth(month, months));
    setSelected(null);
  }

  return (
    <PageShell title="History">
      <MonthCalendar
        month={month}
        today={today}
        selected={day}
        byDay={byDay}
        canGoForward={month < monthOf(today)}
        onStep={step}
        onSelect={(date) => setSelected(date === day ? null : date)}
      />
      {legend.length > 0 && (
        <ul className="calendar-legend">
          {legend.map((type) => (
            <li key={type}>
              <span className="day-dot" style={{ background: dayTypeColor(type) }} />
              <IonNote>{DAY_TYPE_LABELS[type]}</IonNote>
            </li>
          ))}
        </ul>
      )}
      {newestFirst.length > 0 && (
        <IonList inset>
          {newestFirst.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
          {day !== null && (
            <IonItem button detail={false} onClick={() => setSelected(null)}>
              <IonLabel color="primary">{`Show all of ${formatMonth(month)}`}</IonLabel>
            </IonItem>
          )}
        </IonList>
      )}
      {sessions?.length === 0 && anyFinished === false && (
        <p className="empty-note">Finished workouts will show here.</p>
      )}
      {sessions?.length === 0 && anyFinished === true && (
        <p className="empty-note">No workouts this month.</p>
      )}
    </PageShell>
  );
}
