import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { archiveExercise, listExercises } from '../../data/exercises';
import { filterExercises, type ExerciseFilter } from '../../domain/exercise-filter';
import { MUSCLES, TRACKING_TYPES } from '../../domain/schemas';
import { MUSCLE_LABELS, TRACKING_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { SwipeToDelete } from '../../ui/SwipeToDelete';

export function LibraryPage() {
  const ctx = useData();
  const exercises = useLive(listExercises);
  const [filter, setFilter] = useState<ExerciseFilter>({
    query: '',
    muscle: 'all',
    trackingType: 'all',
  });
  const shown = useMemo(() => filterExercises(exercises ?? [], filter), [exercises, filter]);

  return (
    <PageShell
      title="Exercises"
      back="/tabs/programs"
      actions={
        <IonButton routerLink="/tabs/programs/library/new" aria-label="Add exercise">
          <IonIcon slot="icon-only" icon={add} aria-hidden="true" />
        </IonButton>
      }
    >
      <IonSearchbar
        aria-label="Search exercises"
        placeholder="Search"
        value={filter.query}
        onIonInput={(e) => setFilter({ ...filter, query: e.detail.value ?? '' })}
      />
      <IonList inset>
        <IonItem>
          <IonSelect
            aria-label="Muscle"
            label="Muscle"
            interface="action-sheet"
            value={filter.muscle}
            onIonChange={(e) => setFilter({ ...filter, muscle: e.detail.value })}
          >
            <IonSelectOption value="all">All</IonSelectOption>
            {MUSCLES.map((m) => (
              <IonSelectOption key={m} value={m}>
                {MUSCLE_LABELS[m]}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonSelect
            aria-label="Tracking"
            label="Tracking"
            interface="action-sheet"
            value={filter.trackingType}
            onIonChange={(e) => setFilter({ ...filter, trackingType: e.detail.value })}
          >
            <IonSelectOption value="all">All</IonSelectOption>
            {TRACKING_TYPES.map((t) => (
              <IonSelectOption key={t} value={t}>
                {TRACKING_LABELS[t]}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </IonList>
      {exercises && shown.length === 0 && <p className="empty-note">No exercises match.</p>}
      {shown.length > 0 && (
        <IonList inset data-testid="exercise-list">
          {shown.map((e) => (
            <SwipeToDelete
              key={e.id}
              label={e.name}
              header={`Delete ${e.name}?`}
              message="It leaves the library. Past workouts and programs that use it keep it."
              onDelete={() => archiveExercise(ctx, e.id)}
            >
              <IonItem routerLink={`/tabs/programs/library/${e.id}`} detail>
                <IonLabel data-testid="exercise-name">{e.name}</IonLabel>
                {e.isCustom && <IonNote slot="end">Custom</IonNote>}
              </IonItem>
            </SwipeToDelete>
          ))}
        </IonList>
      )}
    </PageShell>
  );
}
