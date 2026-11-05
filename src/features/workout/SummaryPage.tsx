import {
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTextarea,
  useIonRouter,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadExerciseMap } from '../../data/exercises';
import { getSessionView, sessionPrs, updateSession } from '../../data/sessions';
import { sessionDurationMs } from '../../domain/consistency';
import { formatDuration, formatPr } from '../../domain/format';
import { workingSetsDone } from '../../domain/log-layout';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';

const TODAY = '/tabs/today';

export function SummaryPage() {
  const { id = '' } = useParams();
  const ctx = useData();
  const router = useIonRouter();
  const { error, guard } = useGuard();
  const view = useLive((c) => getSessionView(c, id), [id]);
  const prs = useLive((c) => sessionPrs(c, id), [id]);
  const exercises = useLive(loadExerciseMap);

  if (!view) return <PageShell title="Summary" back={TODAY} children={null} />;
  const { session } = view;
  const isTest = session.dayType === 'test';
  const duration = sessionDurationMs(session);
  const lines = (prs ?? []).flatMap((pr) => {
    const exercise = exercises?.get(pr.exerciseId);
    return exercise ? [formatPr(pr, exercise)] : [];
  });

  return (
    <PageShell title="Summary" back={TODAY}>
      <IonList inset>
        <IonListHeader>
          <IonLabel>{session.name}</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonLabel>Duration</IonLabel>
          <IonNote slot="end">{duration === null ? '' : formatDuration(duration)}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Working sets</IonLabel>
          <IonNote slot="end">{workingSetsDone(view.exercises.flatMap((e) => e.sets))}</IonNote>
        </IonItem>
      </IonList>

      {lines.length > 0 && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>New PRs</IonLabel>
          </IonListHeader>
          {lines.map((line) => (
            <IonItem key={line}>
              <IonLabel className="ion-text-wrap">{line}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      )}

      <IonList inset>
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

      <div className="ion-padding">
        <IonButton
          expand="block"
          onClick={() =>
            isTest
              ? router.push(`${TODAY}/test/${id}`, 'forward', 'replace')
              : router.push(TODAY, 'back', 'replace')
          }
        >
          {isTest ? 'Continue' : 'Close'}
        </IonButton>
      </div>
    </PageShell>
  );
}
