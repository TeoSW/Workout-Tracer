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
import { arrowUp } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadBandMap } from '../../data/bands';
import { loadExerciseMap } from '../../data/exercises';
import { deleteDayTemplate, editDayTemplate, getProgram } from '../../data/programs';
import { formatPlanLine } from '../../domain/format';
import { moveBlock, removeBlock } from '../../domain/program-edit';
import { DAY_TYPES, type Block, type DayTemplate, type DayType } from '../../domain/schemas';
import { DAY_TYPE_LABELS } from '../../ui/labels';
import { useGoBack } from '../../ui/navigation';
import { PageShell } from '../../ui/PageShell';
import { SaveButton } from '../../ui/SaveButton';
import { SwipeToDelete } from '../../ui/SwipeToDelete';
import { useConfirm } from '../../ui/useConfirm';
import { ErrorNote, useGuard } from '../../ui/useGuard';

export function DayEditorPage() {
  const { id = '', dayId = '' } = useParams();
  const ctx = useData();
  const programUrl = `/tabs/programs/${id}`;
  const goBack = useGoBack(programUrl);
  const confirm = useConfirm();
  const { error, guard } = useGuard();
  const loaded = useLive((c) => getProgram(c, id), [id]);
  const exercises = useLive(loadExerciseMap);
  const bands = useLive(loadBandMap);
  const day = loaded?.dayTemplates.find((d) => d.id === dayId);

  if (!day || !exercises || !bands) {
    return <PageShell title="Day" back={programUrl} children={null} />;
  }

  const edit = (change: (d: DayTemplate) => DayTemplate) =>
    void guard(() => editDayTemplate(ctx, dayId, change));
  const nameOf = (block: Block) =>
    block.kind === 'choice'
      ? block.choiceSlot.label
      : (exercises.get(block.exerciseId)?.name ?? block.exerciseId);
  const lineOf = (block: Block) => {
    if (block.kind === 'choice') return `Pick one of ${block.choiceSlot.options.length}`;
    const exercise = exercises.get(block.exerciseId);
    return exercise ? formatPlanLine(block, exercise, bands) : '';
  };

  async function remove() {
    const yes = await confirm({
      header: 'Delete this day?',
      message: 'It also leaves the schedule. Past workouts stay in History.',
      confirm: 'Delete',
    });
    if (!yes) return;
    await guard(async () => {
      await deleteDayTemplate(ctx, dayId);
      goBack();
    });
  }

  const blocks = [...day.blocks].sort((a, b) => a.order - b.order);

  return (
    <PageShell
      title={day.name}
      back={programUrl}
      actions={<SaveButton back={programUrl} error={error} />}
    >
      <IonList inset>
        <IonItem>
          <IonInput
            aria-label="Day name"
            label="Name"
            value={day.name}
            onIonChange={(e) => {
              const name = (e.detail.value ?? '').trim();
              if (name !== '') edit((d) => ({ ...d, name }));
            }}
          />
        </IonItem>
        <IonItem>
          <IonSelect
            aria-label="Day type"
            label="Day type"
            interface="action-sheet"
            value={day.dayType}
            onIonChange={(e) => edit((d) => ({ ...d, dayType: e.detail.value as DayType }))}
          >
            {DAY_TYPES.map((t) => (
              <IonSelectOption key={t} value={t}>
                {DAY_TYPE_LABELS[t]}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
        <IonItem>
          <IonToggle
            aria-label="Skip deloads"
            checked={day.deloadExempt}
            onIonChange={(e) => edit((d) => ({ ...d, deloadExempt: e.detail.checked }))}
          >
            Skip deloads
          </IonToggle>
        </IonItem>
        <IonItem>
          <IonTextarea
            aria-label="Day note"
            label="Note"
            labelPlacement="stacked"
            autoGrow
            value={day.note}
            onIonChange={(e) => edit((d) => ({ ...d, note: e.detail.value ?? '' }))}
          />
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Exercises</IonLabel>
        </IonListHeader>
        {blocks.map((block, index) => (
          <SwipeToDelete
            key={block.id}
            label={nameOf(block)}
            header={`Remove ${nameOf(block)} from this day?`}
            onDelete={() => edit((d) => removeBlock(d, block.id))}
          >
            <IonItem routerLink={`${programUrl}/days/${dayId}/blocks/${block.id}`}>
              <IonLabel>
                <h2>{nameOf(block)}</h2>
                <p>{lineOf(block)}</p>
              </IonLabel>
              {index > 0 && (
                <IonButton
                  slot="end"
                  fill="clear"
                  aria-label={`Move ${nameOf(block)} up`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    edit((d) => moveBlock(d, block.id, 'up'));
                  }}
                >
                  <IonIcon slot="icon-only" icon={arrowUp} aria-hidden="true" />
                </IonButton>
              )}
            </IonItem>
          </SwipeToDelete>
        ))}
        <IonItem routerLink={`${programUrl}/days/${dayId}/add`} detail={false}>
          <IonLabel color="primary">Add exercise</IonLabel>
        </IonItem>
        <IonItem routerLink={`${programUrl}/days/${dayId}/add-choice`} detail={false}>
          <IonLabel color="primary">Add choice slot</IonLabel>
        </IonItem>
      </IonList>

      <ErrorNote error={error} />
      <IonList inset>
        <IonItem button detail={false} onClick={() => void remove()}>
          <IonLabel color="danger">Delete day</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
