import {
  IonBadge,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonTextarea,
  IonToggle,
  useIonRouter,
} from '@ionic/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import {
  activateProgram,
  addDayTemplate,
  archiveProgram,
  deactivateProgram,
  deleteProgram,
  editProgram,
  getProgram,
  removeDeloadThisWeek,
  setDeloadThisWeek,
  setProgramCurrentWeek,
} from '../../data/programs';
import { addDays, mondayOf } from '../../domain/dates';
import { formatCycleWeek } from '../../domain/format';
import { cyclePosition } from '../../domain/schedule';
import type { Program } from '../../domain/schemas';
import { DAY_TYPE_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { SaveButton } from '../../ui/SaveButton';
import { Stepper } from '../../ui/Stepper';
import { useConfirm } from '../../ui/useConfirm';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { ScheduleEditor } from './ScheduleEditor';

const PROGRAMS = '/tabs/programs';

export function ProgramEditorPage() {
  const { id = '' } = useParams();
  const ctx = useData();
  const router = useIonRouter();
  const confirm = useConfirm();
  const loaded = useLive((c) => getProgram(c, id), [id]);
  const [dayName, setDayName] = useState('');
  const { error, guard: guarded, setError } = useGuard();

  if (!loaded) return <PageShell title="Program" back={PROGRAMS} children={null} />;
  const { program, dayTemplates: days } = loaded;

  const save = (change: (p: Program) => Program) =>
    void guarded(() => editProgram(ctx, id, change));

  const today = ctx.clock.today();
  const position = program.active ? cyclePosition(program, today) : null;
  const deloadedThisWeek = program.manualDeloadWeeks.includes(mondayOf(today));

  async function addDay() {
    if (dayName.trim() === '') {
      setError('Give the day a name.');
      return;
    }
    await guarded(() => addDayTemplate(ctx, id, { name: dayName.trim(), dayType: 'hypertrophy' }));
    setDayName('');
  }

  async function remove() {
    const yes = await confirm({
      header: 'Delete this program?',
      message: 'Past workouts stay in History.',
      confirm: 'Delete',
    });
    if (!yes) return;
    await deleteProgram(ctx, id);
    router.push(PROGRAMS, 'back', 'replace');
  }

  return (
    <PageShell title={program.name} back={PROGRAMS} actions={<SaveButton back={PROGRAMS} />}>
      <IonList inset>
        <IonItem>
          <IonInput
            aria-label="Program name"
            label="Name"
            value={program.name}
            onIonChange={(e) => {
              const name = (e.detail.value ?? '').trim();
              if (name !== '') save((p) => ({ ...p, name }));
            }}
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            aria-label="Program note"
            label="Note"
            labelPlacement="stacked"
            autoGrow
            value={program.note}
            onIonChange={(e) => save((p) => ({ ...p, note: e.detail.value ?? '' }))}
          />
        </IonItem>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Status</IonLabel>
        </IonListHeader>
        {program.active ? (
          <>
            <IonItem>
              <IonLabel>{program.cycleWeeks === null ? 'Rotation' : 'Current week'}</IonLabel>
              {position && program.cycleWeeks !== null && (
                <IonNote slot="end">
                  {formatCycleWeek(position.cycleWeek, program.cycleWeeks)}
                </IonNote>
              )}
              <IonBadge slot="end" color="success">
                Active
              </IonBadge>
            </IonItem>
            {position && program.cycleWeeks !== null && (
              <Stepper
                label="Set current week"
                noun="current week"
                value={position.cycleWeek}
                min={1}
                max={program.cycleWeeks}
                onChange={(week) => void guarded(() => setProgramCurrentWeek(ctx, id, week))}
              />
            )}
            <IonItem>
              <IonToggle
                aria-label="Deload this week"
                checked={deloadedThisWeek}
                onIonChange={(e) =>
                  void guarded(() =>
                    e.detail.checked ? setDeloadThisWeek(ctx, id) : removeDeloadThisWeek(ctx, id),
                  )
                }
              >
                Deload this week
              </IonToggle>
            </IonItem>
            <IonItem button detail={false} onClick={() => void deactivateProgram(ctx, id)}>
              <IonLabel color="primary">Stop using this program</IonLabel>
            </IonItem>
          </>
        ) : (
          <>
            <IonItem
              button
              detail={false}
              onClick={() => void guarded(() => activateProgram(ctx, id, 'this_week'))}
            >
              <IonLabel color="primary">Start this week</IonLabel>
              <IonNote slot="end">{mondayOf(today)}</IonNote>
            </IonItem>
            <IonItem
              button
              detail={false}
              onClick={() => void guarded(() => activateProgram(ctx, id, 'next_week'))}
            >
              <IonLabel color="primary">Start next week</IonLabel>
              <IonNote slot="end">{addDays(mondayOf(today), 7)}</IonNote>
            </IonItem>
          </>
        )}
      </IonList>

      <ScheduleEditor program={program} days={days} onChange={save} />
      <ErrorNote error={error} />

      <IonList inset>
        <IonListHeader>
          <IonLabel>Days</IonLabel>
        </IonListHeader>
        {days.map((d) => (
          <IonItem key={d.id} routerLink={`${PROGRAMS}/${id}/days/${d.id}`} detail>
            <IonLabel>
              <h2>{d.name}</h2>
              <p>{DAY_TYPE_LABELS[d.dayType]}</p>
            </IonLabel>
          </IonItem>
        ))}
        <IonItem>
          <IonInput
            aria-label="New day name"
            placeholder="New day name"
            value={dayName}
            onIonInput={(e) => setDayName(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem button detail={false} onClick={() => void addDay()}>
          <IonLabel color="primary">Add day</IonLabel>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonItem routerLink={`${PROGRAMS}/${id}/share`} detail>
          <IonLabel>Share program</IonLabel>
        </IonItem>
        <IonItem
          button
          detail={false}
          onClick={() =>
            void archiveProgram(ctx, id).then(() => router.push(PROGRAMS, 'back', 'replace'))
          }
        >
          <IonLabel>Archive program</IonLabel>
        </IonItem>
        <IonItem button detail={false} onClick={() => void remove()}>
          <IonLabel color="danger">Delete program</IonLabel>
        </IonItem>
      </IonList>
    </PageShell>
  );
}
