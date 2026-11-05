import { IonInput, IonItem, IonList, IonTextarea, useIonActionSheet } from '@ionic/react';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadBandMap } from '../../data/bands';
import { loadExerciseMap } from '../../data/exercises';
import {
  getSessionView,
  removeExercise,
  setSessionDuration,
  updateSession,
} from '../../data/sessions';
import { getSettings } from '../../data/settings';
import { sessionDurationMs } from '../../domain/consistency';
import { logItems } from '../../domain/log-layout';
import type { LoggedSet } from '../../domain/schemas';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { ExerciseCard, type CardActions } from '../workout/ExerciseCard';
import { SetSheet } from '../workout/SetSheet';
import { useSetEditor } from '../workout/useSetEditor';

const NO_LAST_SETS = new Map<string, LoggedSet[]>();

/** Corrects a finished workout. Each change saves at once, and PRs and stats follow it. */
export function SessionEditPage() {
  const { id = '' } = useParams();
  const ctx = useData();
  const { error, guard } = useGuard();
  const [presentSheet] = useIonActionSheet();
  const view = useLive((c) => getSessionView(c, id), [id]);
  const settings = useLive(getSettings);
  const exercises = useLive(loadExerciseMap);
  const bands = useLive(loadBandMap);
  const editor = useSetEditor(exercises, guard);
  const nowMs = useCallback(() => ctx.clock.now(), [ctx]);
  const back = `/tabs/history/${id}`;

  if (!view || !settings || !exercises || !bands) {
    return <PageShell title="Edit workout" back={back} children={null} />;
  }

  const { session } = view;
  const blocks = session.planSnapshot?.blocks ?? [];
  const items = logItems(view.exercises, blocks);
  const duration = sessionDurationMs(session);

  const actions: CardActions = {
    ...editor.setActions,
    openMenu: (entry) => {
      void presentSheet({
        header: exercises.get(entry.exerciseId)?.name ?? '',
        buttons: [
          { text: 'Note', handler: () => editor.editNote(entry) },
          {
            text: 'Remove',
            role: 'destructive',
            handler: () => void guard(() => removeExercise(ctx, entry.id)),
          },
          { text: 'Cancel', role: 'cancel' },
        ],
      });
    },
  };

  return (
    <PageShell title="Edit workout" back={back}>
      <IonList inset>
        <IonItem>
          <IonInput
            label="Name"
            labelPlacement="stacked"
            value={session.name}
            onIonChange={(e) => {
              const name = e.detail.value ?? '';
              void guard(() => updateSession(ctx, id, { name }));
            }}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label="Duration in minutes"
            labelPlacement="stacked"
            inputmode="numeric"
            value={duration === null ? '' : Math.round(duration / 60_000)}
            onIonChange={(e) => {
              const minutes = Number(e.detail.value);
              void guard(() => setSessionDuration(ctx, id, minutes));
            }}
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            aria-label="Session notes"
            label="Notes"
            labelPlacement="stacked"
            autoGrow
            value={session.notes}
            onIonChange={(e) => {
              const notes = e.detail.value ?? '';
              void guard(() => updateSession(ctx, id, { notes }));
            }}
          />
        </IonItem>
      </IonList>
      <ErrorNote error={error} />
      {items.map((item) =>
        item.kind === 'choice' ? null : (
          <ExerciseCard
            key={item.exercises[0]?.id}
            entries={item.exercises}
            blocks={blocks}
            exercises={exercises}
            lastSets={NO_LAST_SETS}
            effortMode={settings.effortMode}
            bands={bands}
            actions={actions}
          />
        ),
      )}
      <SetSheet
        open={editor.openSet}
        bands={[...bands.values()]}
        effortMode={settings.effortMode}
        nowMs={nowMs}
        onDone={(open, draft) => void editor.saveSet(open, draft)}
        onClose={editor.closeSet}
      />
    </PageShell>
  );
}
