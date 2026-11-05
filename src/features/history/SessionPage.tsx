import {
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  useIonRouter,
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadBandMap } from '../../data/bands';
import { loadExerciseMap } from '../../data/exercises';
import {
  deleteSession,
  getSessionView,
  sessionPrs,
  type SessionExerciseView,
} from '../../data/sessions';
import { getSettings } from '../../data/settings';
import { sessionDurationMs } from '../../domain/consistency';
import { formatDuration, formatLongDate, formatPr, formatSetResult } from '../../domain/format';
import { setLabel, workingSetsDone } from '../../domain/log-layout';
import type { Band, EffortMode, Exercise } from '../../domain/schemas';
import { DAY_TYPE_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { useConfirm } from '../../ui/useConfirm';
import { ErrorNote, useGuard } from '../../ui/useGuard';

const HISTORY = '/tabs/history';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <IonItem>
      <IonLabel>{label}</IonLabel>
      <IonNote slot="end">{value}</IonNote>
    </IonItem>
  );
}

function ExerciseLog(props: {
  entry: SessionExerciseView;
  exercise: Exercise;
  prSetIds: ReadonlySet<string>;
  effortMode: EffortMode;
  bands: ReadonlyMap<string, Band>;
}) {
  const { entry, exercise, prSetIds, effortMode, bands } = props;
  // Sets never logged are left out, as if the plan had fewer.
  const done = entry.sets.filter((s) => s.done);
  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>{exercise.name}</IonLabel>
      </IonListHeader>
      {entry.note !== '' && (
        <IonItem>
          <IonLabel className="ion-text-wrap">{entry.note}</IonLabel>
        </IonItem>
      )}
      {done.map((set) => (
        <IonItem key={set.id}>
          <IonLabel className="ion-text-wrap">
            {exercise.trackingType === 'checklist'
              ? 'Done'
              : `${setLabel(done, set).text} · ${formatSetResult(set, exercise, effortMode, bands)}`}
          </IonLabel>
          {prSetIds.has(set.id) && (
            <IonBadge slot="end" color="success">
              PR
            </IonBadge>
          )}
        </IonItem>
      ))}
    </IonList>
  );
}

/** A finished workout, read-only. Edit opens the same values for correcting. */
export function SessionPage() {
  const { id = '' } = useParams();
  const ctx = useData();
  const router = useIonRouter();
  const confirm = useConfirm();
  const { error, guard } = useGuard();
  const view = useLive((c) => getSessionView(c, id), [id]);
  const prs = useLive((c) => sessionPrs(c, id), [id]);
  const settings = useLive(getSettings);
  const exercises = useLive(loadExerciseMap);
  const bands = useLive(loadBandMap);

  if (view === null) {
    return (
      <PageShell title="Workout" back={HISTORY}>
        <p className="empty-note">This workout is no longer here.</p>
      </PageShell>
    );
  }
  if (!view || !settings || !exercises || !bands) {
    return <PageShell title="Workout" back={HISTORY} children={null} />;
  }

  const { session } = view;
  const duration = sessionDurationMs(session);
  const allSets = view.exercises.flatMap((e) => e.sets);
  const logged = view.exercises.filter((e) => e.sets.some((s) => s.done));
  const prSetIds = new Set((prs ?? []).flatMap((pr) => pr.setId ?? []));
  const prLines = (prs ?? []).flatMap((pr) => {
    const exercise = exercises.get(pr.exerciseId);
    return exercise ? [formatPr(pr, exercise)] : [];
  });

  async function remove() {
    const yes = await confirm({
      header: 'Delete this workout?',
      message: 'Everything logged in it is deleted, and stats change to match.',
      confirm: 'Delete',
    });
    if (!yes) return;
    await guard(async () => {
      await deleteSession(ctx, id);
      router.push(HISTORY, 'back', 'pop');
    });
  }

  return (
    <PageShell
      title={session.name}
      back={HISTORY}
      actions={<IonButton routerLink={`${HISTORY}/${id}/edit`}>Edit</IonButton>}
    >
      <IonList inset>
        <Fact label="Date" value={formatLongDate(session.date)} />
        <Fact label="Type" value={DAY_TYPE_LABELS[session.dayType]} />
        {session.isDeload && <Fact label="Deload" value="Yes" />}
        {duration !== null && <Fact label="Duration" value={formatDuration(duration)} />}
        <Fact label="Working sets" value={String(workingSetsDone(allSets, exercises))} />
      </IonList>

      {prLines.length > 0 && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>PRs in this workout</IonLabel>
          </IonListHeader>
          {prLines.map((line) => (
            <IonItem key={line}>
              <IonLabel className="ion-text-wrap">{line}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      )}

      {session.notes !== '' && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Notes</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel className="ion-text-wrap">{session.notes}</IonLabel>
          </IonItem>
        </IonList>
      )}

      {logged.map((entry) => {
        const exercise = exercises.get(entry.exerciseId);
        return exercise ? (
          <ExerciseLog
            key={entry.id}
            entry={entry}
            exercise={exercise}
            prSetIds={prSetIds}
            effortMode={settings.effortMode}
            bands={bands}
          />
        ) : null;
      })}

      <ErrorNote error={error} />
      <IonList inset>
        <IonItem button detail={false} onClick={() => void remove()}>
          <IonLabel color="danger">Delete workout</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
