import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
  useIonActionSheet,
  useIonAlert,
  useIonRouter,
} from '@ionic/react';
import { useCallback, useEffect, useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { loadBandMap } from '../../data/bands';
import { loadExerciseMap } from '../../data/exercises';
import { startRestTimer } from '../../data/rest-timer';
import {
  addSet,
  deleteSession,
  finishSession,
  getActiveSession,
  lastSetsByExercise,
  moveExercise,
  pickChoice,
  removeExercise,
  removeSet,
  setExerciseNote,
  swapExercise,
  toggleWarmup,
  updateSet,
  type SessionExerciseView,
} from '../../data/sessions';
import { getSettings, setSetting } from '../../data/settings';
import { formatDuration } from '../../domain/format';
import { logItems } from '../../domain/log-layout';
import { restAfterSet } from '../../domain/rest-plan';
import type { ChoiceBlock, Exercise, LoggedSet } from '../../domain/schemas';
import { draftFor, draftFromSet, draftToPatch, type SetDraft } from '../../domain/set-draft';
import { unlockAudio } from '../../pwa/audio';
import { allowSleep, isWakeLockSupported, keepAwake } from '../../pwa/wake-lock';
import { PageShell } from '../../ui/PageShell';
import { useConfirm } from '../../ui/useConfirm';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { ExerciseCard, type CardActions } from './ExerciseCard';
import { SetSheet, type SheetSet } from './SetSheet';

const TODAY = '/tabs/today';

function useElapsed(startedAt: number | undefined): string {
  const ctx = useData();
  const [now, setNow] = useState(() => ctx.clock.now());
  useEffect(() => {
    const tick = setInterval(() => setNow(ctx.clock.now()), 1000);
    return () => clearInterval(tick);
  }, [ctx]);
  return startedAt === undefined ? '' : formatDuration(Math.max(0, now - startedAt));
}

function ChoiceCard(props: {
  block: ChoiceBlock;
  exercises: ReadonlyMap<string, Exercise>;
  onPick: (index: number) => void;
}) {
  const { block, exercises, onPick } = props;
  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>{block.choiceSlot.label}: pick one</IonLabel>
      </IonListHeader>
      {block.choiceSlot.options.map((option, index) => (
        <IonItem key={option.exerciseId} button detail={false} onClick={() => onPick(index)}>
          <IonLabel className="ion-text-wrap">
            <h2>{exercises.get(option.exerciseId)?.name ?? option.exerciseId}</h2>
            <p>{option.pickWhen}</p>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}

function InfoSheet(props: {
  entry: SessionExerciseView | null;
  exercises: ReadonlyMap<string, Exercise>;
  blockNote: string | undefined;
  onClose: () => void;
}) {
  const { entry, exercises, blockNote, onClose } = props;
  const exercise = entry ? exercises.get(entry.exerciseId) : undefined;
  return (
    <IonModal
      isOpen={entry !== null}
      breakpoints={[0, 0.5, 1]}
      initialBreakpoint={0.5}
      onDidDismiss={onClose}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{exercise?.name ?? ''}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          {blockNote && (
            <IonItem>
              <IonLabel className="ion-text-wrap">{blockNote}</IonLabel>
            </IonItem>
          )}
          {exercise && exercise.cues !== '' && (
            <IonItem>
              <IonLabel className="ion-text-wrap">{exercise.cues}</IonLabel>
            </IonItem>
          )}
          {exercise?.alternativeIds.map((id) => (
            <IonItem key={id}>
              <IonLabel>{exercises.get(id)?.name ?? id}</IonLabel>
              <IonNote slot="end">Alternative</IonNote>
            </IonItem>
          ))}
          {!blockNote && exercise?.cues === '' && exercise.alternativeIds.length === 0 && (
            <p className="empty-note">No notes for this exercise.</p>
          )}
        </IonList>
      </IonContent>
    </IonModal>
  );
}

export function WorkoutPage() {
  const ctx = useData();
  const router = useIonRouter();
  const confirm = useConfirm();
  const { error, guard } = useGuard();
  const [presentSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  const view = useLive(getActiveSession);
  const settings = useLive(getSettings);
  const exercises = useLive(loadExerciseMap);
  const bands = useLive(loadBandMap);
  const exerciseKey = view?.exercises.map((e) => e.exerciseId).join(',') ?? '';
  const lastSets = useLive(
    (c) =>
      view
        ? lastSetsByExercise(
            c,
            view.exercises.map((e) => e.exerciseId),
            view.session.id,
          )
        : Promise.resolve(new Map<string, LoggedSet[]>()),
    [exerciseKey, view?.session.id],
  );
  const [openSet, setOpenSet] = useState<SheetSet | null>(null);
  const [info, setInfo] = useState<SessionExerciseView | null>(null);
  const elapsed = useElapsed(view?.session.startedAt);
  const sessionId = view?.session.id;
  const keepOn = settings?.keepAwake;
  const nowMs = useCallback(() => ctx.clock.now(), [ctx]);

  useEffect(() => {
    if (sessionId && keepOn) void keepAwake();
    if (keepOn === false) void allowSleep();
  }, [sessionId, keepOn]);

  if (view === undefined || !settings || !exercises || !bands) {
    return <PageShell title="Workout" back={TODAY} children={null} />;
  }
  if (view === null) {
    return (
      <PageShell title="Workout" back={TODAY}>
        <p className="empty-note">No workout is open.</p>
      </PageShell>
    );
  }

  const { session } = view;
  const blocks = session.planSnapshot?.blocks ?? [];
  const items = logItems(view.exercises, blocks);
  const showTip = keepOn === true && !settings.wakeLockTipShown && !isWakeLockSupported();

  async function startRestFor(sessionExerciseId: string) {
    if (!exercises) return;
    const seconds = restAfterSet({
      blocks,
      sessionExercises: view?.exercises ?? [],
      sessionExerciseId,
      exercisesById: exercises,
    });
    if (seconds !== null) await startRestTimer(ctx, session.id, seconds);
  }

  async function saveSet(open: SheetSet, draft: SetDraft) {
    unlockAudio();
    setOpenSet(null);
    await guard(async () => {
      await updateSet(ctx, open.set.id, draftToPatch(draft, open.exercise));
      // A set edited after it was logged does not start the timer again.
      if (!open.set.done) await startRestFor(open.set.sessionExerciseId);
    });
  }

  function chooseSwap(entry: SessionExerciseView) {
    const exercise = exercises?.get(entry.exerciseId);
    const original = entry.swappedFromExerciseId;
    const ids = [...(exercise?.alternativeIds ?? []), ...(original !== null ? [original] : [])];
    void presentSheet({
      header: 'Swap for this workout',
      buttons: [
        ...ids.map((id) => ({
          text: exercises?.get(id)?.name ?? id,
          handler: () => void guard(() => swapExercise(ctx, entry.id, id)),
        })),
        { text: 'Cancel', role: 'cancel' },
      ],
    });
  }

  function editNote(entry: SessionExerciseView) {
    void presentAlert({
      header: 'Note',
      inputs: [{ name: 'note', type: 'textarea', value: entry.note }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (values: { note: string }) =>
            void guard(() => setExerciseNote(ctx, entry.id, values.note)),
        },
      ],
    });
  }

  const actions: CardActions = {
    openSet: (entry, set, last) => {
      const exercise = exercises.get(entry.exerciseId);
      if (!exercise) return;
      unlockAudio();
      const draft = set.done
        ? draftFromSet(set, exercise)
        : draftFor({ exercise, target: set.target ?? {}, last });
      setOpenSet({ set, exercise, draft, title: exercise.name });
    },
    toggleChecklist: (set, done) => void guard(() => updateSet(ctx, set.id, { done })),
    deleteSet: (set) => void guard(() => removeSet(ctx, set.id)),
    toggleWarmup: (set) => void guard(() => toggleWarmup(ctx, set.id)),
    addSet: (entry) => void guard(() => addSet(ctx, entry.id)),
    openInfo: setInfo,
    openMenu: (entry) => {
      const canSwap =
        !entry.sets.some((s) => s.done) &&
        ((exercises.get(entry.exerciseId)?.alternativeIds.length ?? 0) > 0 ||
          entry.swappedFromExerciseId !== null);
      void presentSheet({
        header: exercises.get(entry.exerciseId)?.name ?? '',
        buttons: [
          { text: 'Add set', handler: () => void guard(() => addSet(ctx, entry.id)) },
          ...(canSwap ? [{ text: 'Swap for this workout', handler: () => chooseSwap(entry) }] : []),
          { text: 'Note', handler: () => editNote(entry) },
          { text: 'Move up', handler: () => void guard(() => moveExercise(ctx, entry.id, 'up')) },
          {
            text: 'Move down',
            handler: () => void guard(() => moveExercise(ctx, entry.id, 'down')),
          },
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

  async function finish() {
    const yes = await confirm({ header: 'Finish this workout?', confirm: 'Finish' });
    if (!yes) return;
    await guard(async () => {
      await finishSession(ctx, session.id);
      await allowSleep();
      router.push(`${TODAY}/summary/${session.id}`, 'forward', 'replace');
    });
  }

  async function discard() {
    const yes = await confirm({
      header: 'Discard this workout?',
      message: 'Everything logged in it is deleted.',
      confirm: 'Discard',
    });
    if (!yes) return;
    await guard(async () => {
      await deleteSession(ctx, session.id);
      await allowSleep();
      router.push(TODAY, 'back', 'replace');
    });
  }

  const infoEntry = info && view.exercises.find((e) => e.id === info.id);

  return (
    <PageShell
      title={session.name}
      subtitle={elapsed}
      back={TODAY}
      actions={
        <IonButton strong data-testid="finish-workout" onClick={() => void finish()}>
          Done
        </IonButton>
      }
    >
      {session.isDeload && <p className="section-note ion-padding-top">Deload week.</p>}
      {session.planSnapshot?.note && (
        <p className="section-note ion-padding-top">{session.planSnapshot.note}</p>
      )}
      {showTip && (
        <p className="section-note ion-padding-top" role="note">
          This phone cannot keep the screen on from here. Raise Auto-Lock in iOS Settings if it
          sleeps during a workout.
          <IonButton
            fill="clear"
            size="small"
            onClick={() => void setSetting(ctx, 'wakeLockTipShown', true)}
          >
            Got it
          </IonButton>
        </p>
      )}
      <ErrorNote error={error} />
      {items.map((item) =>
        item.kind === 'choice' ? (
          <ChoiceCard
            key={item.block.id}
            block={item.block}
            exercises={exercises}
            onPick={(index) => void guard(() => pickChoice(ctx, session.id, item.block.id, index))}
          />
        ) : (
          <ExerciseCard
            key={item.exercises[0]?.id}
            entries={item.exercises}
            blocks={blocks}
            exercises={exercises}
            lastSets={lastSets ?? new Map<string, LoggedSet[]>()}
            effortMode={settings.effortMode}
            bands={bands}
            actions={actions}
          />
        ),
      )}
      <IonList inset>
        <IonItem routerLink={`${TODAY}/workout/add`} detail>
          <IonLabel>Add exercise</IonLabel>
        </IonItem>
        <IonItem button detail={false} onClick={() => void discard()}>
          <IonLabel color="danger">Discard workout</IonLabel>
        </IonItem>
      </IonList>
      <SetSheet
        open={openSet}
        bands={[...bands.values()]}
        effortMode={settings.effortMode}
        nowMs={nowMs}
        onDone={(open, draft) => void saveSet(open, draft)}
        onClose={() => setOpenSet(null)}
      />
      <InfoSheet
        entry={infoEntry ?? null}
        exercises={exercises}
        blockNote={blocks.find((b) => b.id === infoEntry?.blockId)?.note}
        onClose={() => setInfo(null)}
      />
    </PageShell>
  );
}
