import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState } from 'react';
import { useData } from '../../app/DataProvider';
import { addCustomExercise } from '../../data/exercises';
import {
  MUSCLES,
  TRACKING_TYPES,
  type Exercise,
  type Muscle,
  type TrackingType,
} from '../../domain/schemas';
import { MUSCLE_LABELS, TRACKING_LABELS } from '../../ui/labels';
import { ErrorNote, useGuard } from '../../ui/useGuard';

/**
 * A quick way to make your own exercise without leaving the list you're adding from. Only the
 * name, how it's logged and its main muscle are asked; the rest can be filled in the library.
 */
export function NewExerciseSheet(props: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (exercise: Exercise) => Promise<void>;
}) {
  const ctx = useData();
  const [name, setName] = useState('');
  const [trackingType, setTrackingType] = useState<TrackingType>('weight_reps');
  const [muscle, setMuscle] = useState<Muscle>('chest');
  const [saving, setSaving] = useState(false);
  const { error, guard, setError } = useGuard();

  useEffect(() => {
    if (!props.open) return;
    setName(props.initialName);
    setTrackingType('weight_reps');
    setMuscle('chest');
  }, [props.open, props.initialName]);

  function save() {
    if (saving) return;
    if (name.trim() === '') {
      setError('Give the exercise a name.');
      return;
    }
    setSaving(true);
    void guard(async () => {
      const exercise = await addCustomExercise(ctx, {
        name: name.trim(),
        trackingType,
        primaryMuscles: [muscle],
        secondaryMuscles: [],
        unilateral: false,
        loadUnit: 'total',
        defaultRestSec: 90,
        cues: '',
        alternativeIds: [],
      });
      await props.onCreated(exercise);
    }).finally(() => setSaving(false));
  }

  return (
    <IonModal
      isOpen={props.open}
      breakpoints={[0, 0.6, 1]}
      initialBreakpoint={0.6}
      onDidDismiss={props.onClose}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={props.onClose}>Cancel</IonButton>
          </IonButtons>
          <IonTitle>Your exercise</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={saving} onClick={save}>
              Add
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonItem>
            <IonInput
              aria-label="Exercise name"
              label="Name"
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonSelect
              aria-label="Logged as"
              label="Logged as"
              interface="action-sheet"
              value={trackingType}
              onIonChange={(e) => setTrackingType(e.detail.value as TrackingType)}
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
              aria-label="Main muscle"
              label="Main muscle"
              interface="action-sheet"
              value={muscle}
              onIonChange={(e) => setMuscle(e.detail.value as Muscle)}
            >
              {MUSCLES.map((m) => (
                <IonSelectOption key={m} value={m}>
                  {MUSCLE_LABELS[m]}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </IonList>
        <ErrorNote error={error} />
      </IonContent>
    </IonModal>
  );
}
