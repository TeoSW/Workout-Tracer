import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { RIR_VALUES, RPE_VALUES, rirToRpe, rpeToRir } from '../../domain/effort';
import type { EffortMode, ExerciseBlock, SetTarget } from '../../domain/schemas';
import { updateBlockTarget } from '../../domain/program-edit';
import { updateSetPlan } from '../../domain/set-plan';
import type { DayTemplate } from '../../domain/schemas';

type EditDay = (change: (day: DayTemplate) => DayTemplate) => void;

const SAME = 'same';
const NONE = 'none';

/** One effort picker in the user's effort mode, RIR or RPE, stored as RIR. */
function EffortSelect(props: {
  label: string;
  mode: Exclude<EffortMode, 'off'>;
  value: number | null | undefined;
  /** Offers "Same as all sets" first when set. */
  inherit?: string;
  onChange: (rir: number | null | undefined) => void;
}) {
  const { mode, value } = props;
  const options = mode === 'rpe' ? RPE_VALUES : RIR_VALUES;
  const shown =
    value === undefined ? (props.inherit ? SAME : NONE) : value === null ? NONE : String(value);
  return (
    <IonSelect
      aria-label={props.label}
      label={props.label}
      interface="action-sheet"
      value={shown}
      onIonChange={(e) => {
        const picked = String(e.detail.value);
        if (picked === SAME) props.onChange(undefined);
        else if (picked === NONE) props.onChange(props.inherit ? null : undefined);
        else props.onChange(Number(picked));
      }}
    >
      {props.inherit && <IonSelectOption value={SAME}>{props.inherit}</IonSelectOption>}
      <IonSelectOption value={NONE}>None</IonSelectOption>
      {options.map((v) => {
        const rir = mode === 'rpe' ? rpeToRir(v) : v;
        return (
          <IonSelectOption key={v} value={String(rir)}>
            {mode === 'rpe' ? `RPE ${v}` : rir >= 5 ? 'RIR 5+' : `RIR ${v}`}
          </IonSelectOption>
        );
      })}
    </IonSelect>
  );
}

function effortText(rir: number | null | undefined, mode: Exclude<EffortMode, 'off'>): string {
  if (rir === undefined || rir === null) return 'none';
  return mode === 'rpe' ? `RPE ${rirToRpe(rir)}` : `RIR ${rir}`;
}

/**
 * The effort for every set, then each working set's own effort and note. Holds and complexes
 * don't log effort, so they only get notes.
 */
export function SetPlanFields(props: { block: ExerciseBlock; mode: EffortMode; onEdit: EditDay }) {
  const { block, mode, onEdit } = props;
  const count = block.setsMax ?? block.setsMin;
  const target: SetTarget = block.target;
  return (
    <IonList inset data-testid="set-plans">
      <IonListHeader>
        <IonLabel>Each set</IonLabel>
      </IonListHeader>
      {mode !== 'off' && (
        <IonItem>
          <EffortSelect
            label="Effort for every set"
            mode={mode}
            value={target.rir}
            onChange={(rir) =>
              onEdit((d) => updateBlockTarget(d, block.id, { rir: rir ?? undefined }))
            }
          />
        </IonItem>
      )}
      {Array.from({ length: count }, (_, i) => {
        const plan = block.setTargets?.[i] ?? {};
        const extra = i >= block.setsMin;
        return (
          <div key={i} className="set-plan">
            <IonItem lines="none">
              <IonLabel>
                <h3>{extra ? `Set ${i + 1} (if done)` : `Set ${i + 1}`}</h3>
              </IonLabel>
              {mode !== 'off' && (
                <IonNote slot="end">
                  {effortText(plan.rir === undefined ? target.rir : plan.rir, mode)}
                </IonNote>
              )}
            </IonItem>
            {mode !== 'off' && (
              <IonItem lines="none">
                <EffortSelect
                  label={`Set ${i + 1} effort`}
                  mode={mode}
                  value={plan.rir}
                  inherit="Same as every set"
                  onChange={(rir) => onEdit((d) => updateSetPlan(d, block.id, i, { rir }))}
                />
              </IonItem>
            )}
            <IonItem>
              <IonInput
                aria-label={`Set ${i + 1} note`}
                placeholder="Note for this set"
                value={plan.note ?? ''}
                onIonChange={(e) =>
                  onEdit((d) => updateSetPlan(d, block.id, i, { note: e.detail.value ?? '' }))
                }
              />
            </IonItem>
          </div>
        );
      })}
    </IonList>
  );
}
