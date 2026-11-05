import { IonItem, IonLabel, IonList, IonSearchbar } from '@ionic/react';
import { useMemo, useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { listExercises } from '../../data/exercises';
import { addExercise, getActiveSession } from '../../data/sessions';
import { filterExercises } from '../../domain/exercise-filter';
import { useGoBack } from '../../ui/navigation';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';

const WORKOUT = '/tabs/today/workout';

export function AddExercisePage() {
  const ctx = useData();
  const goBack = useGoBack(WORKOUT);
  const exercises = useLive(listExercises);
  const view = useLive(getActiveSession);
  const { error, guard } = useGuard();
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () => filterExercises(exercises ?? [], { query, muscle: 'all', trackingType: 'all' }),
    [exercises, query],
  );
  const sessionId = view?.session.id;

  return (
    <PageShell title="Add exercise" back={WORKOUT}>
      <IonSearchbar
        aria-label="Search exercises"
        placeholder="Search"
        value={query}
        onIonInput={(e) => setQuery(e.detail.value ?? '')}
      />
      <ErrorNote error={error} />
      <IonList inset>
        {shown.map((e) => (
          <IonItem
            key={e.id}
            button
            detail={false}
            onClick={() => {
              if (!sessionId) return;
              void guard(async () => {
                await addExercise(ctx, sessionId, e.id);
                goBack();
              });
            }}
          >
            <IonLabel>{e.name}</IonLabel>
          </IonItem>
        ))}
      </IonList>
    </PageShell>
  );
}
