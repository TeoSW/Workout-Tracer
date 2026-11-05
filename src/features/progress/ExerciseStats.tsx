import { IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';
import { useState } from 'react';
import { useLive } from '../../app/DataProvider';
import { getSettings } from '../../data/settings';
import { loadExerciseStats } from '../../data/stats';
import { exerciseCharts, sessionLog } from '../../domain/exercise-series';
import {
  capitalize,
  formatDateWithYear,
  formatRecord,
  formatSetResult,
  formatShortDate,
} from '../../domain/format';
import { setLabel } from '../../domain/log-layout';
import { currentRecords } from '../../domain/prs';
import type { Exercise } from '../../domain/schemas';
import { SpecChart } from './SpecChart';

const LOG_PAGE = 20;

/** Records, charts and the full set history of one exercise, loaded with Recharts. */
export default function ExerciseStats({ exercise }: { exercise: Exercise }) {
  const stats = useLive((c) => loadExerciseStats(c, exercise.id), [exercise.id]);
  const settings = useLive(getSettings);
  const [shown, setShown] = useState(LOG_PAGE);
  if (!stats || !settings) return null;

  const log = sessionLog(stats.sessions, stats.sets);
  if (log.length === 0) return <p className="section-note">No sets logged yet.</p>;

  const charts = exerciseCharts({ ...stats, exercise });
  const records = currentRecords({ ...stats, exercise, sessions: log });

  return (
    <>
      {records.length > 0 && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Records</IonLabel>
          </IonListHeader>
          {records.map((record) => (
            <IonItem key={`${record.kind}-${record.key}`}>
              <IonLabel className="ion-text-wrap">{capitalize(formatRecord(record))}</IonLabel>
              <IonNote slot="end">{formatShortDate(record.date)}</IonNote>
            </IonItem>
          ))}
        </IonList>
      )}
      {charts.map((chart) => (
        <SpecChart key={chart.id} spec={chart} />
      ))}
      <IonList inset>
        <IonListHeader>
          <IonLabel>Set history</IonLabel>
        </IonListHeader>
        {log.slice(0, shown).map(({ session, sets }) => (
          <IonItem key={session.id} routerLink={`/tabs/history/${session.id}`} detail>
            <IonLabel className="ion-text-wrap">
              <h2>{`${formatDateWithYear(session.date)} · ${session.name}`}</h2>
              {sets.map((set) => (
                <p key={set.id}>
                  {`${setLabel(sets, set).text} · ${formatSetResult(
                    set,
                    exercise,
                    settings.effortMode,
                    stats.bandsById,
                  )}`}
                </p>
              ))}
            </IonLabel>
          </IonItem>
        ))}
        {log.length > shown && (
          <IonItem button detail={false} onClick={() => setShown(shown + LOG_PAGE)}>
            <IonLabel color="primary">Show more</IonLabel>
          </IonItem>
        )}
      </IonList>
    </>
  );
}
