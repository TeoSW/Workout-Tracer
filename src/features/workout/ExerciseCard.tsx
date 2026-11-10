import {
  IonButton,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonNote,
  IonToggle,
} from '@ionic/react';
import {
  checkmark,
  checkmarkCircleOutline,
  ellipsisHorizontal,
  informationCircleOutline,
} from 'ionicons/icons';
import { Fragment } from 'react';
import type { SessionExerciseView } from '../../data/sessions';
import { formatEffort } from '../../domain/effort';
import { formatLastTime, formatPlanLine, formatSetResult } from '../../domain/format';
import { lastTimeSet } from '../../domain/last-time';
import { setLabel } from '../../domain/log-layout';
import type { Band, Block, EffortMode, Exercise, LoggedSet } from '../../domain/schemas';

export type CardActions = {
  openSet: (entry: SessionExerciseView, set: LoggedSet, last: LoggedSet | null) => void;
  /** Logs a pending set with its prefilled values in one tap. Only a running workout has it. */
  quickLog?: (entry: SessionExerciseView, set: LoggedSet, last: LoggedSet | null) => void;
  toggleChecklist: (set: LoggedSet, done: boolean) => void;
  deleteSet: (set: LoggedSet) => void;
  toggleWarmup: (set: LoggedSet) => void;
  addSet: (entry: SessionExerciseView) => void;
  openInfo?: (entry: SessionExerciseView) => void;
  openMenu: (entry: SessionExerciseView) => void;
};

function SetRow(props: {
  entry: SessionExerciseView;
  set: LoggedSet;
  exercise: Exercise;
  lastSets: readonly LoggedSet[];
  effortMode: EffortMode;
  bands: ReadonlyMap<string, Band>;
  actions: CardActions;
}) {
  const { entry, set, exercise, lastSets, effortMode, bands, actions } = props;
  const label = setLabel(entry.sets, set);
  const last = lastTimeSet(lastSets, set.kind, label.number);
  const hint = last ? formatLastTime(last, exercise, bands) : 'tap to log';
  const plan = [formatEffort(set.target?.rir ?? null, effortMode), set.target?.note ?? '']
    .filter((part) => part !== '')
    .join(' · ');

  return (
    <IonItemSliding>
      <IonItem button detail={false} onClick={() => actions.openSet(entry, set, last)}>
        <IonLabel>
          {set.done ? (
            `${label.text} · ${formatSetResult(set, exercise, effortMode, bands)}`
          ) : (
            <>
              {label.text}
              <p>{hint}</p>
              {plan !== '' && <p className="set-plan-line">{`Plan: ${plan}`}</p>}
            </>
          )}
        </IonLabel>
        {set.done && <IonIcon slot="end" icon={checkmark} color="success" aria-label="Done" />}
        {!set.done && actions.quickLog && (
          <IonButton
            slot="end"
            fill="clear"
            className="set-check"
            aria-label={`Log ${label.text.toLowerCase()} of ${exercise.name}`}
            onClick={(event) => {
              event.stopPropagation();
              actions.quickLog?.(entry, set, last);
            }}
          >
            <IonIcon slot="icon-only" icon={checkmarkCircleOutline} aria-hidden="true" />
          </IonButton>
        )}
      </IonItem>
      <IonItemOptions side="end">
        <IonItemOption color="medium" onClick={() => actions.toggleWarmup(set)}>
          {set.kind === 'warmup' ? 'Working' : 'Warm-up'}
        </IonItemOption>
        <IonItemOption color="danger" onClick={() => actions.deleteSet(set)}>
          Delete
        </IonItemOption>
      </IonItemOptions>
    </IonItemSliding>
  );
}

function ExerciseRows(props: {
  entry: SessionExerciseView;
  exercise: Exercise;
  block: Block | undefined;
  lastSets: readonly LoggedSet[];
  effortMode: EffortMode;
  bands: ReadonlyMap<string, Band>;
  actions: CardActions;
}) {
  const { entry, exercise, block, lastSets, effortMode, bands, actions } = props;
  const plan = block?.kind === 'exercise' ? formatPlanLine(block, exercise, bands, effortMode) : '';
  const isChecklist = exercise.trackingType === 'checklist';
  const upTo = block?.setsMax;

  return (
    <>
      <IonItem lines="full">
        <IonLabel>
          <h2>{exercise.name}</h2>
          {plan !== '' && <p>{plan}</p>}
          {entry.swappedFromExerciseId !== null && <p>Swapped for this workout</p>}
          {entry.note !== '' && <p>{entry.note}</p>}
        </IonLabel>
        {actions.openInfo && (
          <IonButton
            slot="end"
            fill="clear"
            aria-label={`About ${exercise.name}`}
            onClick={() => actions.openInfo?.(entry)}
          >
            <IonIcon slot="icon-only" icon={informationCircleOutline} aria-hidden="true" />
          </IonButton>
        )}
        <IonButton
          slot="end"
          fill="clear"
          aria-label={`Options for ${exercise.name}`}
          onClick={() => actions.openMenu(entry)}
        >
          <IonIcon slot="icon-only" icon={ellipsisHorizontal} aria-hidden="true" />
        </IonButton>
      </IonItem>
      {entry.sets.map((set) =>
        isChecklist ? (
          <IonItem key={set.id}>
            <IonToggle
              aria-label={`${exercise.name} done`}
              checked={set.done}
              onIonChange={(e) => actions.toggleChecklist(set, e.detail.checked)}
            >
              Done
            </IonToggle>
          </IonItem>
        ) : (
          <SetRow
            key={set.id}
            entry={entry}
            set={set}
            exercise={exercise}
            lastSets={lastSets}
            effortMode={effortMode}
            bands={bands}
            actions={actions}
          />
        ),
      )}
      {!isChecklist && (
        <IonItem button detail={false} onClick={() => actions.addSet(entry)}>
          <IonLabel color="primary">Add set</IonLabel>
          {upTo !== undefined && <IonNote slot="end">up to {upTo}</IonNote>}
        </IonItem>
      )}
    </>
  );
}

/** One inset card, or one joined card when the exercises are a superset. */
export function ExerciseCard(props: {
  entries: SessionExerciseView[];
  blocks: readonly Block[];
  exercises: ReadonlyMap<string, Exercise>;
  lastSets: ReadonlyMap<string, LoggedSet[]>;
  effortMode: EffortMode;
  bands: ReadonlyMap<string, Band>;
  actions: CardActions;
}) {
  const { entries, blocks, exercises, lastSets, effortMode, bands, actions } = props;
  return (
    <IonList inset>
      {entries.length > 1 && (
        <IonItem lines="none">
          <IonNote>Superset</IonNote>
        </IonItem>
      )}
      {entries.map((entry) => {
        const exercise = exercises.get(entry.exerciseId);
        if (!exercise) return null;
        return (
          <Fragment key={entry.id}>
            <ExerciseRows
              entry={entry}
              exercise={exercise}
              block={blocks.find((b) => b.id === entry.blockId)}
              lastSets={lastSets.get(entry.exerciseId) ?? []}
              effortMode={effortMode}
              bands={bands}
              actions={actions}
            />
          </Fragment>
        );
      })}
    </IonList>
  );
}
