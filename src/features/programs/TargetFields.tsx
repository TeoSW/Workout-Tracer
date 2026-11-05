import {
  IonButton,
  IonCheckbox,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { close } from 'ionicons/icons';
import type { Band, ComplexPartTarget, Exercise, SetTarget } from '../../domain/schemas';

function NumberField(props: {
  label: string;
  value: number | undefined;
  /** Kg take decimals. Reps, seconds and attempts are whole numbers. */
  decimal?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const { label, value, decimal = false, onChange } = props;
  return (
    <IonItem>
      <IonInput
        aria-label={label}
        label={label}
        inputmode={decimal ? 'decimal' : 'numeric'}
        value={value ?? ''}
        onIonChange={(e) => {
          const text = (e.detail.value ?? '').trim().replace(',', '.');
          const parsed = Number(text);
          if (text === '') onChange(undefined);
          else if (Number.isFinite(parsed) && parsed >= 0) {
            onChange(decimal ? parsed : Math.round(parsed));
          }
        }}
      />
    </IonItem>
  );
}

type NumberKey =
  | 'repsMin'
  | 'repsMax'
  | 'secondsMin'
  | 'secondsMax'
  | 'attemptsMin'
  | 'attemptsMax'
  | 'loadMinKg'
  | 'loadMaxKg';

/** Each end saves on its own, so a quick edit to one end cannot undo the other. */
function RangeFields(props: {
  label: string;
  target: SetTarget;
  min: NumberKey;
  max: NumberKey;
  decimal?: boolean;
  onChange: (patch: Partial<SetTarget>) => void;
}) {
  const { label, target, min, max, decimal = false, onChange } = props;
  return (
    <>
      <NumberField
        label={`${label} min`}
        value={target[min]}
        decimal={decimal}
        onChange={(v) => onChange({ [min]: v })}
      />
      <NumberField
        label={`${label} max`}
        value={target[max]}
        decimal={decimal}
        onChange={(v) => onChange({ [max]: v })}
      />
    </>
  );
}

function BandFields(props: {
  bands: Band[];
  target: SetTarget;
  onChange: (patch: Partial<SetTarget>) => void;
}) {
  const { bands, target, onChange } = props;
  const selected = target.bandIds ?? [];
  // An archived band stays listed while a target uses it, so it can be taken off.
  const shown = bands.filter((b) => !b.archived || selected.includes(b.id));
  return shown.map((band) => (
    <IonItem key={band.id}>
      <IonCheckbox
        aria-label={`Band ${band.label}`}
        checked={selected.includes(band.id)}
        onIonChange={(e) => {
          const bandIds = e.detail.checked
            ? [...selected, band.id]
            : selected.filter((id) => id !== band.id);
          onChange({ bandIds, addedKg: undefined });
        }}
      >
        Band {band.label}
      </IonCheckbox>
    </IonItem>
  ));
}

function LevelField(props: {
  exercise: Exercise;
  target: SetTarget;
  onChange: (patch: Partial<SetTarget>) => void;
}) {
  const { exercise, target, onChange } = props;
  if (!exercise.progressionLadder) return null;
  return (
    <IonItem>
      <IonSelect
        aria-label="Level"
        label="Level"
        interface="action-sheet"
        value={target.progressionLevel ?? 'none'}
        onIonChange={(e) => {
          const value = e.detail.value as string;
          onChange({ progressionLevel: value === 'none' ? undefined : value });
        }}
      >
        <IonSelectOption value="none">Not set</IonSelectOption>
        <IonSelectOption value="current">Current</IonSelectOption>
        {exercise.progressionLadder.map((level) => (
          <IonSelectOption key={level} value={level}>
            {level}
          </IonSelectOption>
        ))}
      </IonSelect>
    </IonItem>
  );
}

function PartsFields(props: { target: SetTarget; onChange: (patch: Partial<SetTarget>) => void }) {
  const { target, onChange } = props;
  const parts = target.parts ?? [];
  const setPart = (index: number, patch: Partial<ComplexPartTarget>) =>
    onChange({ parts: parts.map((p, i) => (i === index ? { ...p, ...patch } : p)) });

  return (
    <>
      {parts.map((part, index) => {
        const n = index + 1;
        return (
          <div key={index}>
            <IonItem>
              <IonInput
                aria-label={`Part ${n} name`}
                label={`Part ${n}`}
                value={part.name}
                onIonChange={(e) => {
                  const name = (e.detail.value ?? '').trim();
                  if (name !== '') setPart(index, { name });
                }}
              />
              <IonButton
                slot="end"
                fill="clear"
                color="medium"
                aria-label={`Remove part ${n}`}
                onClick={() => onChange({ parts: parts.filter((_, i) => i !== index) })}
              >
                <IonIcon slot="icon-only" icon={close} aria-hidden="true" />
              </IonButton>
            </IonItem>
            <IonItem>
              <IonSelect
                aria-label={`Part ${n} unit`}
                label="Counted in"
                interface="action-sheet"
                value={part.unit}
                onIonChange={(e) => setPart(index, { unit: e.detail.value })}
              >
                <IonSelectOption value="reps">Reps</IonSelectOption>
                <IonSelectOption value="seconds">Seconds</IonSelectOption>
              </IonSelect>
            </IonItem>
            <NumberField
              label={`Part ${n} target`}
              value={part.target}
              onChange={(v) => setPart(index, { target: v ?? 0 })}
            />
          </div>
        );
      })}
      <IonItem
        button
        detail={false}
        onClick={() => onChange({ parts: [...parts, { name: 'Part', unit: 'reps', target: 3 }] })}
      >
        <IonLabel color="primary">Add part</IonLabel>
      </IonItem>
    </>
  );
}

/** The target fields that fit an exercise's tracking type. */
export function TargetFields(props: {
  exercise: Exercise;
  target: SetTarget;
  bands: Band[];
  /** Gets only the fields that changed. */
  onChange: (patch: Partial<SetTarget>) => void;
}) {
  const { exercise, target, bands, onChange: patch } = props;
  const reps = (
    <RangeFields label="Reps" target={target} min="repsMin" max="repsMax" onChange={patch} />
  );
  const seconds = (
    <RangeFields
      label="Seconds"
      target={target}
      min="secondsMin"
      max="secondsMax"
      onChange={patch}
    />
  );
  const bandFields = <BandFields bands={bands} target={target} onChange={patch} />;
  const level = <LevelField exercise={exercise} target={target} onChange={patch} />;

  switch (exercise.trackingType) {
    case 'weight_reps':
      return (
        <>
          {reps}
          <RangeFields
            label="Load"
            target={target}
            min="loadMinKg"
            max="loadMaxKg"
            decimal
            onChange={patch}
          />
        </>
      );
    case 'bodyweight_reps':
      return (
        <>
          {reps}
          <NumberField
            label="Added kg"
            value={target.addedKg}
            decimal
            onChange={(addedKg) =>
              patch(addedKg ? { addedKg, bandIds: undefined } : { addedKg: undefined })
            }
          />
          {bandFields}
          {level}
        </>
      );
    case 'hold':
      return (
        <>
          <IonItem>
            <IonToggle
              aria-label="Max attempt"
              checked={target.isMax === true}
              onIonChange={(e) => patch({ isMax: e.detail.checked ? true : undefined })}
            >
              Max attempt
            </IonToggle>
          </IonItem>
          {seconds}
          {bandFields}
          {level}
        </>
      );
    case 'complex':
      return (
        <>
          <PartsFields target={target} onChange={patch} />
          {bandFields}
          {level}
        </>
      );
    case 'attempts':
      return (
        <RangeFields
          label="Attempts"
          target={target}
          min="attemptsMin"
          max="attemptsMax"
          onChange={patch}
        />
      );
    case 'checklist':
      return null;
  }
}
