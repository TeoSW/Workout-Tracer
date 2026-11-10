import { IonItem, IonLabel, IonList, IonSearchbar } from '@ionic/react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { listExercises } from '../../data/exercises';
import { editDayTemplate } from '../../data/programs';
import { filterExercises } from '../../domain/exercise-filter';
import { addChoiceBlock, addExerciseBlock } from '../../domain/program-edit';
import type { Exercise } from '../../domain/schemas';
import { useGoBack } from '../../ui/navigation';
import { PageShell } from '../../ui/PageShell';
import { NewExerciseSheet } from '../library/NewExerciseSheet';

/** Picks an exercise for a day, as a new block or as the first option of a choice slot. */
export function AddBlockPage({ asChoice = false }: { asChoice?: boolean }) {
  const { id = '', dayId = '' } = useParams();
  const ctx = useData();
  const dayUrl = `/tabs/programs/${id}/days/${dayId}`;
  const goBack = useGoBack(dayUrl);
  const exercises = useLive(listExercises);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const shown = useMemo(
    () => filterExercises(exercises ?? [], { query, muscle: 'all', trackingType: 'all' }),
    [exercises, query],
  );

  async function add(exercise: Exercise) {
    const addTo = asChoice ? addChoiceBlock : addExerciseBlock;
    await editDayTemplate(ctx, dayId, (day) => addTo(day, exercise, ctx.newId));
    goBack();
  }

  return (
    <PageShell title={asChoice ? 'First option' : 'Add exercise'} back={dayUrl}>
      <IonSearchbar
        aria-label="Search exercises"
        placeholder="Search"
        value={query}
        onIonInput={(e) => setQuery(e.detail.value ?? '')}
      />
      <IonList inset>
        <IonItem button detail={false} onClick={() => setCreating(true)}>
          <IonLabel color="primary">Add your exercise</IonLabel>
        </IonItem>
      </IonList>
      <NewExerciseSheet
        open={creating}
        initialName={query}
        onClose={() => setCreating(false)}
        onCreated={async (exercise) => {
          setCreating(false);
          await add(exercise);
        }}
      />
      <IonList inset>
        {shown.map((e) => (
          <IonItem key={e.id} button detail={false} onClick={() => void add(e)}>
            <IonLabel>{e.name}</IonLabel>
          </IonItem>
        ))}
      </IonList>
    </PageShell>
  );
}
