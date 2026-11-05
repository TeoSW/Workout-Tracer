import { IonButton, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';
import { Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { archiveExercise, getExercise, loadExerciseMap } from '../../data/exercises';
import { MUSCLE_LABELS, TRACKING_LABELS } from '../../ui/labels';
import { useGoBack } from '../../ui/navigation';
import { PageShell } from '../../ui/PageShell';

const LOAD_UNIT_LABELS = { total: 'Total', per_hand: 'Per hand', per_side: 'Per side' };
const LIBRARY = '/tabs/programs/library';

// Charts stay out of the first load, here as on the Progress tab.
const ExerciseStats = lazy(() => import('../progress/ExerciseStats'));

/** One exercise. It opens from the library, or from Progress with `base` set to that list. */
export function ExerciseDetailPage({ base = LIBRARY }: { base?: string }) {
  const { exerciseId = '' } = useParams();
  const ctx = useData();
  const goBack = useGoBack(base);
  const exercise = useLive((c) => getExercise(c, exerciseId), [exerciseId]);
  const all = useLive(loadExerciseMap);

  if (!exercise) return <PageShell title="Exercise" back={base} children={null} />;

  const muscleList = (muscles: typeof exercise.primaryMuscles) =>
    muscles.length > 0 ? muscles.map((m) => MUSCLE_LABELS[m]).join(', ') : 'None';

  return (
    <PageShell
      title={exercise.name}
      back={base}
      actions={<IonButton routerLink={`${LIBRARY}/${exercise.id}/edit`}>Edit</IonButton>}
    >
      <IonList inset>
        <IonItem>
          <IonLabel>Tracking</IonLabel>
          <IonNote slot="end">{TRACKING_LABELS[exercise.trackingType]}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Primary</IonLabel>
          <IonNote slot="end">{muscleList(exercise.primaryMuscles)}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Secondary</IonLabel>
          <IonNote slot="end">{muscleList(exercise.secondaryMuscles)}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Load</IonLabel>
          <IonNote slot="end">{LOAD_UNIT_LABELS[exercise.loadUnit]}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Rest</IonLabel>
          <IonNote slot="end">{exercise.defaultRestSec}s</IonNote>
        </IonItem>
      </IonList>

      {exercise.cues !== '' && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Cues</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel className="ion-text-wrap">{exercise.cues}</IonLabel>
          </IonItem>
        </IonList>
      )}

      {exercise.alternativeIds.length > 0 && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Alternatives</IonLabel>
          </IonListHeader>
          {exercise.alternativeIds.map((id) => (
            <IonItem key={id} routerLink={`${base}/${id}`} detail>
              <IonLabel>{all?.get(id)?.name ?? id}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      )}

      <Suspense fallback={null}>
        <ExerciseStats exercise={exercise} />
      </Suspense>

      <IonList inset>
        <IonItem
          button
          detail={false}
          onClick={() => void archiveExercise(ctx, exercise.id).then(goBack)}
        >
          <IonLabel color="danger">Archive exercise</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
