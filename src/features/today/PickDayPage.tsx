import { IonItem, IonLabel, IonList } from '@ionic/react';
import { useLive } from '../../app/DataProvider';
import { getTodayOverview } from '../../data/today';
import { DAY_TYPE_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { useStartWorkout } from './useStartWorkout';

/** Any day of the active program, for rest days and days done out of order. */
export function PickDayPage() {
  const overview = useLive(getTodayOverview);
  const { startDay } = useStartWorkout();
  const { error, guard } = useGuard();
  const program = overview?.program;

  return (
    <PageShell title="Start another day" back="/tabs/today">
      <IonList inset>
        {program &&
          overview.days.map((day) => (
            <IonItem
              key={day.id}
              button
              detail={false}
              onClick={() =>
                void guard(() => startDay({ programId: program.id, dayTemplateId: day.id }))
              }
            >
              <IonLabel>
                <h2>{day.name}</h2>
                <p>{DAY_TYPE_LABELS[day.dayType]}</p>
              </IonLabel>
            </IonItem>
          ))}
      </IonList>
      <ErrorNote error={error} />
    </PageShell>
  );
}
