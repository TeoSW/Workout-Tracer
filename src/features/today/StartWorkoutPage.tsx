import {
  IonBadge,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { useState } from 'react';
import { useData, useLive } from '../../app/DataProvider';
import { loadBandMap } from '../../data/bands';
import { loadExerciseMap } from '../../data/exercises';
import { getTodayOverview } from '../../data/today';
import type { Weekday } from '../../domain/dates';
import { formatCycleWeek, formatPlanLine } from '../../domain/format';
import { resolvePlan } from '../../domain/plan';
import type { DataContext } from '../../data/context';
import { daysForWeek, type WeekDay } from '../../domain/week-days';
import { Chips } from '../../ui/Chips';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { useStartWorkout } from './useStartWorkout';

const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

async function loadStart(ctx: DataContext) {
  const [overview, exercises, bands] = await Promise.all([
    getTodayOverview(ctx),
    loadExerciseMap(ctx),
    loadBandMap(ctx),
  ]);
  return { overview, exercises, bands };
}

/**
 * Pick the week and day to train, see the exercises, then start. It opens on today's plan, so
 * the usual case is one more tap.
 */
export function StartWorkoutPage() {
  const ctx = useData();
  const data = useLive(loadStart);
  const { startDay } = useStartWorkout();
  const { error, guard } = useGuard();
  const [week, setWeek] = useState<number | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const program = data?.overview.program ?? null;
  const plan = data?.overview.plan ?? null;
  if (!data || !program || !plan) {
    return (
      <PageShell title="Start workout" back="/tabs/today">
        {data && <p className="empty-note">Pick a program first.</p>}
      </PageShell>
    );
  }
  const { overview, exercises, bands } = data;
  const cycleWeeks = program.cycleWeeks ?? 1;
  const currentWeek = plan.cycle?.cycleWeek ?? 1;
  const chosenWeek = week ?? currentWeek;
  const weekly = program.schedule.kind === 'weekday' && cycleWeeks > 1;
  const { planned, others } = daysForWeek(program, overview.days, chosenWeek);
  const todays =
    plan.today.status === 'planned'
      ? plan.today.day
      : plan.next && (plan.next.date === null || plan.next.date === ctx.clock.today())
        ? plan.next
        : null;
  const defaultDay =
    chosenWeek === currentWeek && todays
      ? todays.dayTemplateId
      : (planned[0]?.dayTemplateId ?? others[0]?.dayTemplateId ?? null);
  const chosenId = dayId ?? defaultDay;
  const day = overview.days.find((d) => d.id === chosenId);
  const preview = day
    ? resolvePlan({
        program,
        dayTemplate: day,
        date: ctx.clock.today(),
        exercisesById: exercises,
        ...(weekly ? { cycleWeek: chosenWeek } : {}),
      })
    : null;
  const nameOf = (id: string) => overview.days.find((d) => d.id === id)?.name ?? 'Workout';

  function dayRow(d: WeekDay) {
    const selected = d.dayTemplateId === chosenId;
    return (
      <IonItem
        key={d.dayTemplateId}
        button
        detail={false}
        aria-pressed={selected}
        onClick={() => setDayId(d.dayTemplateId)}
      >
        {d.weekday && (
          <IonNote slot="start" className="day-weekday">
            {WEEKDAY_SHORT[d.weekday]}
          </IonNote>
        )}
        <IonLabel className="ion-text-wrap">{nameOf(d.dayTemplateId)}</IonLabel>
        {selected && <IonIcon slot="end" icon={checkmark} color="primary" aria-label="Selected" />}
      </IonItem>
    );
  }

  function start() {
    if (!day || busy || !program) return;
    setBusy(true);
    const rotationIndex =
      todays && todays.dayTemplateId === day.id && todays.rotationIndex !== null
        ? { rotationIndex: todays.rotationIndex }
        : {};
    void guard(() =>
      startDay({
        programId: program.id,
        dayTemplateId: day.id,
        ...rotationIndex,
        ...(weekly && chosenWeek !== currentWeek ? { cycleWeek: chosenWeek } : {}),
      }),
    ).finally(() => setBusy(false));
  }

  return (
    <PageShell title="Start workout" back="/tabs/today">
      {weekly && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Week</IonLabel>
          </IonListHeader>
          <Chips
            options={Array.from({ length: cycleWeeks }, (_, i) => i + 1)}
            label={(w) => (w === currentWeek ? `Week ${w} (now)` : `Week ${w}`)}
            isOn={(w) => w === chosenWeek}
            onTap={(w) => {
              setWeek(w);
              setDayId(null);
            }}
          />
        </IonList>
      )}

      <IonList inset data-testid="start-days">
        <IonListHeader>
          <IonLabel>Day</IonLabel>
        </IonListHeader>
        {planned.map(dayRow)}
        {others.length > 0 && (
          <IonListHeader>
            <IonLabel>Other days</IonLabel>
          </IonListHeader>
        )}
        {others.map(dayRow)}
      </IonList>

      {preview && day && (
        <IonList inset data-testid="start-preview">
          <IonListHeader>
            <IonLabel>
              {weekly ? `${day.name}, ${formatCycleWeek(chosenWeek, cycleWeeks)}` : day.name}
            </IonLabel>
          </IonListHeader>
          {preview.isDeload && (
            <IonItem>
              <IonBadge color="warning">Deload</IonBadge>
              <IonLabel className="ion-padding-start">Half the sets this week.</IonLabel>
            </IonItem>
          )}
          {preview.blocks.map((block) => {
            const exercise =
              block.kind === 'exercise' ? exercises.get(block.exerciseId) : undefined;
            return (
              <IonItem key={block.id}>
                <IonLabel className="ion-text-wrap">
                  <h3>
                    {block.kind === 'choice' ? block.choiceSlot.label : (exercise?.name ?? '')}
                  </h3>
                  {exercise && block.kind === 'exercise' && (
                    <p>{formatPlanLine(block, exercise, bands)}</p>
                  )}
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>
      )}

      <div className="ion-padding">
        <IonButton expand="block" size="large" disabled={!day || busy} onClick={start}>
          Start workout
        </IonButton>
      </div>
      <ErrorNote error={error} />
    </PageShell>
  );
}
