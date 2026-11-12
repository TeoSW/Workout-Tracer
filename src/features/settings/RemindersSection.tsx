import { IonInput, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';
import { useState } from 'react';
import { useData } from '../../app/DataProvider';
import { getTodayOverview } from '../../data/today';
import { calendarFile, plannedEvents } from '../../domain/calendar-file';
import { Stepper } from '../../ui/Stepper';
import { ErrorNote, useGuard } from '../../ui/useGuard';

/** Opens a calendar file the way iOS shows "Add All" for it, instead of saving it to Files. */
function openCalendar(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function utcStamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Reminders for training days, through the phone's Calendar. A web app can't notify while it is
 * closed, but Calendar can, so the app hands it the days with an alert on each.
 */
export function RemindersSection() {
  const ctx = useData();
  const [time, setTime] = useState('18:00');
  const [alertMinutes, setAlertMinutes] = useState(60);
  const [weeks, setWeeks] = useState(8);
  const [message, setMessage] = useState<string | null>(null);
  const { error, guard, setError } = useGuard();

  function addReminders() {
    void guard(async () => {
      const { program, days, plan } = await getTodayOverview(ctx);
      if (!program) {
        setError('Pick a program first, under Programs.');
        return;
      }
      const next =
        plan?.today.status === 'planned' ? plan.today.day.rotationIndex : plan?.next?.rotationIndex;
      const events = plannedEvents({
        program,
        days,
        from: ctx.clock.today(),
        weeks,
        ...(next === null || next === undefined ? {} : { nextRotationIndex: next }),
      });
      if (events.length === 0) {
        setError('No training days in those weeks.');
        return;
      }
      openCalendar(
        calendarFile({
          events,
          time,
          durationMinutes: 75,
          alertMinutes,
          stamp: utcStamp(ctx.clock.now()),
        }),
      );
      setMessage(`${events.length} training days. Tap Add All in Calendar.`);
    });
  }

  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>Workout reminders</IonLabel>
      </IonListHeader>
      <IonItem>
        <IonInput
          aria-label="Training time"
          label="Training time"
          type="time"
          value={time}
          onIonInput={(e) => setTime(e.detail.value ?? '18:00')}
        />
      </IonItem>
      <Stepper
        label="Remind me before"
        noun="minutes before"
        unit=" min"
        step={15}
        min={0}
        max={240}
        value={alertMinutes}
        onChange={setAlertMinutes}
      />
      <Stepper
        label="For the next"
        noun="weeks"
        unit=" weeks"
        min={1}
        max={26}
        value={weeks}
        onChange={setWeeks}
      />
      <IonItem button detail={false} onClick={addReminders}>
        <IonLabel color="primary">Add reminders to Calendar</IonLabel>
      </IonItem>
      {message && (
        <IonItem>
          <IonNote role="status">{message}</IonNote>
        </IonItem>
      )}
      <ErrorNote error={error} />
    </IonList>
  );
}
