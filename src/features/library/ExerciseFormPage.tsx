import {
  IonButton,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import {
  addCustomExercise,
  getExercise,
  listExercises,
  updateExercise,
  type NewExercise,
} from '../../data/exercises';
import {
  MUSCLES,
  TRACKING_TYPES,
  type EffortMode,
  type Exercise,
  type LoadUnit,
} from '../../domain/schemas';
import { MUSCLE_LABELS, TRACKING_LABELS } from '../../ui/labels';
import { useGoBack } from '../../ui/navigation';
import { PageShell } from '../../ui/PageShell';
import { Stepper } from '../../ui/Stepper';

const LIBRARY = '/tabs/programs/library';

const BLANK: NewExercise = {
  name: '',
  trackingType: 'weight_reps',
  primaryMuscles: [],
  secondaryMuscles: [],
  unilateral: false,
  loadUnit: 'total',
  defaultRestSec: 90,
  cues: '',
  alternativeIds: [],
};

function ExerciseForm({ exercise }: { exercise?: Exercise }) {
  const ctx = useData();
  const goBack = useGoBack(LIBRARY);
  const [draft, setDraft] = useState<NewExercise>(exercise ?? BLANK);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<NewExercise>) => setDraft({ ...draft, ...patch });
  const isBuiltIn = exercise !== undefined && !exercise.isCustom;
  const others = (useLive(listExercises) ?? []).filter((e) => e.id !== exercise?.id);

  function setLevels(text: string) {
    const levels = text
      .split(',')
      .map((level) => level.trim())
      .filter((level) => level !== '');
    const { progressionLadder: _unused, ...rest } = draft;
    setDraft(levels.length > 0 ? { ...rest, progressionLadder: levels } : rest);
  }

  async function save() {
    if (draft.name.trim() === '') {
      setError('Give the exercise a name.');
      return;
    }
    try {
      if (exercise) await updateExercise(ctx, { ...exercise, ...draft });
      else await addCustomExercise(ctx, draft);
      goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <PageShell
      title={exercise ? 'Edit exercise' : 'New exercise'}
      back={LIBRARY}
      actions={
        <IonButton strong onClick={() => void save()}>
          Save
        </IonButton>
      }
    >
      <IonList inset>
        {!isBuiltIn && (
          <>
            <IonItem>
              <IonInput
                aria-label="Name"
                label="Name"
                value={draft.name}
                onIonInput={(e) => change({ name: e.detail.value ?? '' })}
              />
            </IonItem>
            <IonItem>
              <IonSelect
                aria-label="Tracking type"
                label="Tracking"
                interface="action-sheet"
                value={draft.trackingType}
                onIonChange={(e) => change({ trackingType: e.detail.value })}
              >
                {TRACKING_TYPES.map((t) => (
                  <IonSelectOption key={t} value={t}>
                    {TRACKING_LABELS[t]}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonSelect
                aria-label="Primary muscles"
                label="Primary"
                multiple
                value={draft.primaryMuscles}
                onIonChange={(e) => change({ primaryMuscles: e.detail.value })}
              >
                {MUSCLES.map((m) => (
                  <IonSelectOption key={m} value={m}>
                    {MUSCLE_LABELS[m]}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonSelect
                aria-label="Secondary muscles"
                label="Secondary"
                multiple
                value={draft.secondaryMuscles}
                onIonChange={(e) => change({ secondaryMuscles: e.detail.value })}
              >
                {MUSCLES.map((m) => (
                  <IonSelectOption key={m} value={m}>
                    {MUSCLE_LABELS[m]}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonSelect
                aria-label="Load"
                label="Load"
                interface="action-sheet"
                value={draft.loadUnit}
                onIonChange={(e) => change({ loadUnit: e.detail.value as LoadUnit })}
              >
                <IonSelectOption value="total">Total</IonSelectOption>
                <IonSelectOption value="per_hand">Per hand</IonSelectOption>
                <IonSelectOption value="per_side">Per side</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonToggle
                aria-label="One arm or leg at a time"
                checked={draft.unilateral}
                onIonChange={(e) => change({ unilateral: e.detail.checked })}
              >
                One arm or leg at a time
              </IonToggle>
            </IonItem>
          </>
        )}
        <IonItem>
          <IonSelect
            aria-label="Alternatives"
            label="Alternatives"
            multiple
            value={draft.alternativeIds}
            onIonChange={(e) => change({ alternativeIds: e.detail.value })}
          >
            {others.map((e) => (
              <IonSelectOption key={e.id} value={e.id}>
                {e.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonInput
            aria-label="Levels"
            label="Levels"
            placeholder="Tuck, Straddle, Full"
            value={draft.progressionLadder?.join(', ') ?? ''}
            onIonChange={(e) => setLevels(e.detail.value ?? '')}
          />
        </IonItem>
        <Stepper
          label="Default rest"
          noun="rest seconds"
          unit="s"
          step={15}
          value={draft.defaultRestSec}
          onChange={(defaultRestSec) => change({ defaultRestSec })}
        />
        <IonItem>
          <IonSelect
            aria-label="Effort input"
            label="Effort input"
            interface="action-sheet"
            value={draft.effortInput ?? 'global'}
            onIonChange={(e) => {
              const value = e.detail.value as EffortMode | 'global';
              const { effortInput: _unused, ...rest } = draft;
              setDraft(value === 'global' ? rest : { ...rest, effortInput: value });
            }}
          >
            <IonSelectOption value="global">Same as settings</IonSelectOption>
            <IonSelectOption value="rir">RIR</IonSelectOption>
            <IonSelectOption value="rpe">RPE</IonSelectOption>
            <IonSelectOption value="off">Off</IonSelectOption>
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonTextarea
            aria-label="Cues"
            label="Cues"
            labelPlacement="stacked"
            autoGrow
            value={draft.cues}
            onIonInput={(e) => change({ cues: e.detail.value ?? '' })}
          />
        </IonItem>
      </IonList>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </PageShell>
  );
}

export function ExerciseNewPage() {
  return <ExerciseForm />;
}

export function ExerciseEditPage() {
  const { exerciseId = '' } = useParams();
  const exercise = useLive((c) => getExercise(c, exerciseId), [exerciseId]);
  if (!exercise) return <PageShell title="Edit exercise" back={LIBRARY} children={null} />;
  return <ExerciseForm key={exercise.id} exercise={exercise} />;
}
