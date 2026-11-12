import {
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTextarea,
  useIonAlert,
  useIonRouter,
} from '@ionic/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadExerciseMap } from '../../data/exercises';
import { addSessionAsDay, getActiveProgram, saveSessionAsProgram } from '../../data/programs';
import { getSessionView, sessionPrs, updateSession } from '../../data/sessions';
import { sessionDurationMs, sessionTimes } from '../../domain/consistency';
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
  const [saved, setSaved] = useState<string | null>(null);
  const view = useLive((c) => getSessionView(c, id), [id]);
  const prs = useLive((c) => sessionPrs(c, id), [id]);
  const exercises = useLive(loadExerciseMap);
  const active = useLive(getActiveProgram);
  const [presentAlert] = useIonAlert();

  /** Asks for a name, then saves the workout as a program or as a day of the active one. */
  function askName(header: string, save: (name: string) => Promise<string>) {
    void presentAlert({
      header,
      inputs: [
        {
          name: 'name',
          type: 'text',
          value: view?.session.name ?? '',
          attributes: { 'aria-label': 'Name' },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (values: { name: string }) =>
            void guard(async () => {
              setSaved(await save(values.name));
            }),
        },
      ],
    });
  }

  if (!view) return <PageShell title="Summary" back={TODAY} children={null} />;
  const { session } = view;
  const isTest = session.dayType === 'test';
  const duration = sessionDurationMs(session);
  const times = sessionTimes(session);
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
          <IonLabel>{times ? 'Total time' : 'Duration'}</IonLabel>
          <IonNote slot="end">{duration === null ? '' : formatDuration(duration)}</IonNote>
        </IonItem>
        {times && (
          <>
            <IonItem>
              <IonLabel>Working time</IonLabel>
              <IonNote slot="end">{formatDuration(times.workingMs)}</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel>Rest time</IonLabel>
              <IonNote slot="end">{formatDuration(times.restMs)}</IonNote>
            </IonItem>
          </>
        )}
        <IonItem>
          <IonLabel>Working sets</IonLabel>
          <IonNote slot="end">
            {workingSetsDone(
              view.exercises.flatMap((e) => e.sets),
              exercises ?? new Map(),
            )}
          </IonNote>
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
      <IonList inset>
        <IonListHeader>
          <IonLabel>Keep this workout</IonLabel>
        </IonListHeader>
        <IonItem
          button
          detail={false}
          onClick={() =>
            askName('Save as a new program', async (name) => {
              const { program } = await saveSessionAsProgram(ctx, id, name);
              return `Saved as ${program.name}, under Programs.`;
            })
          }
        >
          <IonLabel color="primary">Save as a new program</IonLabel>
        </IonItem>
        {active && active.id !== session.programId && (
          <IonItem
            button
            detail={false}
            onClick={() =>
              askName(`Add to ${active.name}`, async (name) => {
                await addSessionAsDay(ctx, id, active.id, name);
                return `Added to ${active.name} as a day.`;
              })
            }
          >
            <IonLabel color="primary">{`Add to ${active.name} as a day`}</IonLabel>
          </IonItem>
        )}
        {saved && (
          <IonItem>
            <IonNote role="status">{saved}</IonNote>
          </IonItem>
        )}
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
