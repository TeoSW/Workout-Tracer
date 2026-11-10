import { IonButton, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';
import { useState } from 'react';
import { useData, useLive, useToday } from '../../app/DataProvider';
import { hasFinishedSession, listMissedInMonth, sessionsInMonth } from '../../data/history';
import { undoMissedDay } from '../../data/missed-days';
import { dayTypesIn, monthOf, sessionsByDay, stepMonth } from '../../domain/calendar';
import { sessionDurationMs } from '../../domain/consistency';
import type { DateStr } from '../../domain/dates';
import { formatDuration, formatMonth, formatShortDate } from '../../domain/format';
import type { MissedDay, Session } from '../../domain/schemas';
import { dayTypeColor } from '../../ui/dayColors';
import { DAY_TYPE_LABELS, MISSED_REASON_LABELS } from '../../ui/labels';
import { useConfirm } from '../../ui/useConfirm';
import { ErrorNote, useGuard } from '../../ui/useGuard';
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

function MissedRow({ missed, onUndo }: { missed: MissedDay; onUndo: () => void }) {
  const detail = [
    formatShortDate(missed.date),
    ...(missed.reason === null ? [] : [MISSED_REASON_LABELS[missed.reason]]),
    ...(missed.note === '' ? [] : [missed.note]),
  ].join(' · ');
  return (
    <IonItem>
      <span slot="start" className="day-dot day-dot-missed" />
      <IonLabel className="ion-text-wrap">
        <h2>{missed.dayName}</h2>
        <p>{detail}</p>
      </IonLabel>
      <IonButton
        slot="end"
        fill="clear"
        onClick={onUndo}
        aria-label={`Undo missed ${missed.dayName}`}
      >
        Undo
      </IonButton>
    </IonItem>
  );
}

function missedByDate(missed: readonly MissedDay[]): Map<DateStr, MissedDay[]> {
  const days = new Map<DateStr, MissedDay[]>();
  for (const m of missed) days.set(m.date, [...(days.get(m.date) ?? []), m]);
  return days;
}

export function HistoryPage() {
  const ctx = useData();
  const confirm = useConfirm();
  const { error, guard } = useGuard();
  const today = useToday();
  const [month, setMonth] = useState(() => monthOf(today));
  const [selected, setSelected] = useState<DateStr | null>(null);
  const sessions = useLive((c) => sessionsInMonth(c, month), [month]);
  const anyFinished = useLive(hasFinishedSession);
  const missed = useLive((c) => listMissedInMonth(c, month), [month]);

  const byDay = sessionsByDay(sessions ?? []);
  const missedByDay = missedByDate(missed ?? []);
  // A deleted session can leave the picked day empty, and an empty day can't be tapped off.
  const day =
    selected !== null && (byDay.has(selected) || missedByDay.has(selected)) ? selected : null;
  const listed = day === null ? (sessions ?? []) : (byDay.get(day) ?? []);
  const missedListed = [...(day === null ? (missed ?? []) : (missedByDay.get(day) ?? []))].sort(
    (a, b) => b.date.localeCompare(a.date),
  );

  function undo(m: MissedDay) {
    void guard(async () => {
      const ok = await confirm({
        header: 'Undo this missed day?',
        message: `${m.dayName} on ${formatShortDate(m.date)} will no longer count as missed.`,
        confirm: 'Undo',
      });
      if (ok) await undoMissedDay(ctx, m.id);
    });
  }
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
        missedByDay={missedByDay}
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
      {missedListed.length > 0 && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Missed</IonLabel>
          </IonListHeader>
          {missedListed.map((m) => (
            <MissedRow key={m.id} missed={m} onUndo={() => undo(m)} />
          ))}
        </IonList>
      )}
      <ErrorNote error={error} />
      {sessions?.length === 0 && anyFinished === false && (
        <p className="empty-note">Finished workouts will show here.</p>
      )}
      {sessions?.length === 0 && missedListed.length === 0 && anyFinished === true && (
        <p className="empty-note">No workouts this month.</p>
      )}
    </PageShell>
  );
}
