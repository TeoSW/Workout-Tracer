import { IonItem, IonLabel, IonList } from '@ionic/react';
import { useLive } from '../../app/DataProvider';
import { listLoggedExercises } from '../../data/stats';
import { TRACKING_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';

export const EXERCISES = '/tabs/progress/exercises';

/** Exercises with logged sets. The whole library stays under Programs. */
export function ExercisesPage() {
  const exercises = useLive(listLoggedExercises);
  return (
    <PageShell title="Exercises" back="/tabs/progress">
      {exercises?.length === 0 && (
        <p className="empty-note">Exercises will show here once you log them.</p>
      )}
      {exercises && exercises.length > 0 && (
        <IonList inset>
          {exercises.map((exercise) => (
            <IonItem key={exercise.id} routerLink={`${EXERCISES}/${exercise.id}`} detail>
              <IonLabel>
                <h2>{exercise.name}</h2>
                <p>{TRACKING_LABELS[exercise.trackingType]}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      )}
    </PageShell>
  );
}
