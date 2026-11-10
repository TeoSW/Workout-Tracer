import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { close } from 'ionicons/icons';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { listBands } from '../../data/bands';
import { listExercises, loadExerciseMap } from '../../data/exercises';
import {
  editChoiceSlot,
  editDayTemplate,
  getProgram,
  removeChoiceOption,
} from '../../data/programs';
import {
  removeBlock,
  setSupersetWithNext,
  updateBlock,
  updateBlockTarget,
} from '../../domain/program-edit';
import type {
  Band,
  ChoiceBlock,
  ChoiceOption,
  ChoiceSlot,
  DayTemplate,
  Exercise,
  ExerciseBlock,
} from '../../domain/schemas';
import { useGoBack } from '../../ui/navigation';
import { PageShell } from '../../ui/PageShell';
import { SaveButton } from '../../ui/SaveButton';
import { Stepper } from '../../ui/Stepper';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { TargetFields } from './TargetFields';

type EditDay = (change: (day: DayTemplate) => DayTemplate) => void;

/** Sets, rest, warm-ups, superset and note: the fields every block has. */
function CommonFields(props: {
  day: DayTemplate;
  block: ExerciseBlock | ChoiceBlock;
  restDefault: number;
  onEdit: EditDay;
}) {
  const { day, block, restDefault, onEdit } = props;
  const ctx = useData();
  const patch = (changes: Parameters<typeof updateBlock>[2]) =>
    onEdit((d) => updateBlock(d, block.id, changes));
  const blocks = [...day.blocks].sort((a, b) => a.order - b.order);
  const next = blocks[blocks.findIndex((b) => b.id === block.id) + 1];
  const linked = block.supersetGroup !== undefined && next?.supersetGroup === block.supersetGroup;

  return (
    <>
      {block.kind === 'exercise' && (
        <>
          <Stepper
            label="Sets"
            noun="sets"
            value={block.setsMin}
            min={1}
            max={20}
            onChange={(setsMin) =>
              patch({
                setsMin,
                setsMax:
                  block.setsMax !== undefined && block.setsMax > setsMin
                    ? block.setsMax
                    : undefined,
              })
            }
          />
          <Stepper
            label="Up to"
            noun="sets at most"
            value={block.setsMax ?? block.setsMin}
            min={block.setsMin}
            max={20}
            onChange={(setsMax) =>
              patch({ setsMax: setsMax > block.setsMin ? setsMax : undefined })
            }
          />
        </>
      )}
      <Stepper
        label="Rest"
        noun="rest seconds"
        unit="s"
        step={15}
        value={block.restSec ?? restDefault}
        onChange={(restSec) => patch({ restSec })}
      />
      <Stepper
        label="Warm-up sets"
        noun="warm-up sets"
        value={block.warmupSets}
        max={5}
        onChange={(warmupSets) => patch({ warmupSets })}
      />
      {next && (
        <IonItem>
          <IonToggle
            aria-label="Superset with the next exercise"
            checked={linked}
            onIonChange={(e) => {
              const on = e.detail.checked;
              onEdit((d) => setSupersetWithNext(d, block.id, on, ctx.newId));
            }}
          >
            Superset with the next exercise
          </IonToggle>
        </IonItem>
      )}
      <IonItem>
        <IonTextarea
          aria-label="Block note"
          label="Note"
          labelPlacement="stacked"
          autoGrow
          value={block.note ?? ''}
          onIonChange={(e) => patch({ note: e.detail.value || undefined })}
        />
      </IonItem>
    </>
  );
}

function ChoiceFields(props: {
  programId: string;
  block: ChoiceBlock;
  exercises: Exercise[];
  byId: ReadonlyMap<string, Exercise>;
  bands: Band[];
  guard: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const { programId, block, exercises, byId, bands, guard } = props;
  const ctx = useData();
  const slot = block.choiceSlot;
  // ion-select keeps its last value and only reports changes, so it is remounted after each pick.
  const [addKey, setAddKey] = useState(0);

  const editSlot = (change: (s: ChoiceSlot) => ChoiceSlot) =>
    void guard(() => editChoiceSlot(ctx, programId, slot.id, change));
  const editOption = (index: number, change: (o: ChoiceOption) => ChoiceOption) =>
    editSlot((s) => ({ ...s, options: s.options.map((o, i) => (i === index ? change(o) : o)) }));

  return (
    <>
      <IonList inset>
        <IonItem>
          <IonInput
            aria-label="Slot label"
            label="Label"
            value={slot.label}
            onIonChange={(e) => {
              const label = (e.detail.value ?? '').trim();
              if (label !== '') editSlot((s) => ({ ...s, label }));
            }}
          />
        </IonItem>
      </IonList>
      {slot.options.map((option, index) => {
        const exercise = byId.get(option.exerciseId);
        return (
          <div key={index} data-testid={`option-${index}`}>
            <IonList inset>
              <IonListHeader>
                <IonLabel>{exercise?.name ?? option.exerciseId}</IonLabel>
                {slot.options.length > 1 && (
                  <IonButton
                    fill="clear"
                    color="medium"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() =>
                      void guard(() => removeChoiceOption(ctx, programId, slot.id, index))
                    }
                  >
                    <IonIcon slot="icon-only" icon={close} aria-hidden="true" />
                  </IonButton>
                )}
              </IonListHeader>
              <Stepper
                label="Sets"
                noun={`sets for option ${index + 1}`}
                value={option.setsMin}
                min={1}
                max={20}
                onChange={(setsMin) => editOption(index, (o) => ({ ...o, setsMin }))}
              />
              {exercise && (
                <TargetFields
                  exercise={exercise}
                  target={option.target}
                  bands={bands}
                  onChange={(patch) =>
                    editOption(index, (o) => ({ ...o, target: { ...o.target, ...patch } }))
                  }
                />
              )}
              <IonItem>
                <IonTextarea
                  aria-label="Pick when"
                  label="Pick when"
                  labelPlacement="stacked"
                  autoGrow
                  value={option.pickWhen}
                  onIonChange={(e) => {
                    const pickWhen = e.detail.value ?? '';
                    editOption(index, (o) => ({ ...o, pickWhen }));
                  }}
                />
              </IonItem>
            </IonList>
          </div>
        );
      })}
      <IonList inset>
        <IonItem>
          <IonSelect
            key={addKey}
            aria-label="Add option"
            label="Add option"
            interface="action-sheet"
            value={null}
            onIonChange={(e) => {
              const exerciseId = e.detail.value as string | null;
              if (exerciseId) {
                editSlot((s) => ({
                  ...s,
                  options: [...s.options, { exerciseId, setsMin: 3, target: {}, pickWhen: '' }],
                }));
              }
              setAddKey(addKey + 1);
            }}
          >
            {exercises.map((e) => (
              <IonSelectOption key={e.id} value={e.id}>
                {e.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </IonList>
    </>
  );
}

export function BlockEditorPage() {
  const { id = '', dayId = '', blockId = '' } = useParams();
  const ctx = useData();
  const dayUrl = `/tabs/programs/${id}/days/${dayId}`;
  const goBack = useGoBack(dayUrl);
  const loaded = useLive((c) => getProgram(c, id), [id]);
  const byId = useLive(loadExerciseMap);
  const exercises = useLive(listExercises);
  const bands = useLive((c) => listBands(c, { includeArchived: true }));
  const { error, guard } = useGuard();

  const day = loaded?.dayTemplates.find((d) => d.id === dayId);
  const block = day?.blocks.find((b) => b.id === blockId);
  if (!day || !block || !byId || !exercises || !bands) {
    return <PageShell title="Exercise" back={dayUrl} children={null} />;
  }

  const edit: EditDay = (change) => void guard(() => editDayTemplate(ctx, dayId, change));
  const exercise = block.kind === 'exercise' ? byId.get(block.exerciseId) : undefined;
  const title = block.kind === 'choice' ? block.choiceSlot.label : (exercise?.name ?? 'Exercise');

  return (
    <PageShell title={title} back={dayUrl} actions={<SaveButton back={dayUrl} />}>
      {block.kind === 'choice' && (
        <ChoiceFields
          programId={id}
          block={block}
          exercises={exercises}
          byId={byId}
          bands={bands}
          guard={guard}
        />
      )}
      <IonList inset>
        {block.kind === 'exercise' && exercise && (
          <TargetFields
            exercise={exercise}
            target={block.target}
            bands={bands}
            onChange={(patch) => edit((d) => updateBlockTarget(d, block.id, patch))}
          />
        )}
        <CommonFields
          day={day}
          block={block}
          restDefault={exercise?.defaultRestSec ?? 90}
          onEdit={edit}
        />
      </IonList>
      <ErrorNote error={error} />
      <IonList inset>
        <IonItem
          button
          detail={false}
          onClick={() =>
            void editDayTemplate(ctx, dayId, (d) => removeBlock(d, block.id)).then(goBack)
          }
        >
          <IonLabel color="danger">Remove from day</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
