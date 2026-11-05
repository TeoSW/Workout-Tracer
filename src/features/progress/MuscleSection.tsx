import { IonButton, IonIcon, IonItem, IonList, IonToggle } from '@ionic/react';
import { chevronBack, chevronForward } from 'ionicons/icons';
import { useState } from 'react';
import type { StatsData } from '../../data/stats';
import { addDays, mondayOf, type DateStr } from '../../domain/dates';
import { formatShortDate } from '../../domain/format';
import { MUSCLES } from '../../domain/schemas';
import {
  averageWeeklySetsPerMuscle,
  musclesInBand,
  weeklySetsPerMuscle,
} from '../../domain/volume';
import { ChartCard } from '../../ui/ChartCard';
import { MuscleBars } from '../../ui/charts/MuscleBars';
import { MUSCLE_LABELS } from '../../ui/labels';

export function MuscleSection({ data, today }: { data: StatsData; today: DateStr }) {
  const thisWeek = mondayOf(today);
  const [week, setWeek] = useState(thisWeek);
  const [average, setAverage] = useState(false);
  const reference = data.settings.muscleReference;
  const input = {
    sessions: data.sessions,
    sets: data.sets,
    exercisesById: data.exercisesById,
  };
  const volume = average
    ? averageWeeklySetsPerMuscle({ ...input, lastWeekStart: week })
    : weeklySetsPerMuscle({ ...input, weekStart: week });
  const rows = MUSCLES.map((m) => ({ muscle: MUSCLE_LABELS[m], sets: volume[m] }));
  const inBand = musclesInBand(volume, reference);

  return (
    <>
      <IonList inset>
        <IonItem>
          <IonButton
            slot="start"
            fill="clear"
            aria-label="Previous week"
            onClick={() => setWeek(addDays(week, -7))}
          >
            <IonIcon slot="icon-only" icon={chevronBack} aria-hidden="true" />
          </IonButton>
          <span className="week-label">{`Week of ${formatShortDate(week)}`}</span>
          <IonButton
            slot="end"
            fill="clear"
            aria-label="Next week"
            disabled={week >= thisWeek}
            onClick={() => setWeek(addDays(week, 7))}
          >
            <IonIcon slot="icon-only" icon={chevronForward} aria-hidden="true" />
          </IonButton>
        </IonItem>
        <IonItem>
          <IonToggle checked={average} onIonChange={(e) => setAverage(e.detail.checked)}>
            4-week average
          </IonToggle>
        </IonItem>
      </IonList>
      <ChartCard
        title="Weekly sets per muscle"
        readout={`${inBand} of ${MUSCLES.length} muscles at ${reference.min}-${reference.max} sets`}
      >
        <MuscleBars rows={rows} reference={reference} />
      </ChartCard>
    </>
  );
}
