import {
  IonBadge,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
} from '@ionic/react';
import { useState } from 'react';
import { useData, useLive, useToday } from '../../app/DataProvider';
import { setBodyweight } from '../../data/bodyweight';
import { getTodayOverview, type TodayOverview } from '../../data/today';
import { parseBodyweight } from '../../domain/bodyweight';
import { isDeloadDay } from '../../domain/deload';
import { formatCycleWeek, formatKg } from '../../domain/format';
import type { PlannedDay } from '../../domain/today';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { useStartWorkout } from './useStartWorkout';

function nameOf(overview: TodayOverview, dayTemplateId: string | null): string {
  return overview.days.find((d) => d.id === dayTemplateId)?.name ?? 'Workout';
}

function NextLine({ overview, next }: { overview: TodayOverview; next: PlannedDay | null }) {
  if (!next) return null;
  const when = next.date === null ? '' : `, ${next.date}`;
  return (
    <IonItem>
      <IonLabel>{`Next: ${nameOf(overview, next.dayTemplateId)}${when}`}</IonLabel>
    </IonItem>
  );
}

function PlanCard({ overview, onError }: { overview: TodayOverview; onError: Guard }) {
  const ctx = useData();
  const { startDay } = useStartWorkout();
  const { plan, program } = overview;
  if (!plan || !program) return null;
  const { today, cycle } = plan;
  const planned = today.status === 'planned' ? today.day : null;
  const day = overview.days.find((d) => d.id === planned?.dayTemplateId);
  const deload = day !== undefined && isDeloadDay(program, day, ctx.clock.today());

  return (
    <IonList inset>
      {cycle && (
        <IonItem>
          <IonLabel>{formatCycleWeek(cycle.cycleWeek, cycle.cycleWeeks)}</IonLabel>
          {deload && (
            <IonBadge slot="end" color="warning">
              Deload
            </IonBadge>
          )}
        </IonItem>
      )}
      {today.status === 'rest' && (
        <IonItem>
          <IonLabel>Rest day</IonLabel>
        </IonItem>
      )}
      {today.status === 'done' && (
        <IonItem>
          <IonLabel>{`Done: ${nameOf(overview, today.dayTemplateId)}`}</IonLabel>
        </IonItem>
      )}
      {planned && (
        <>
          <IonItem>
            <IonLabel>{nameOf(overview, planned.dayTemplateId)}</IonLabel>
          </IonItem>
          <div className="ion-padding">
            <IonButton
              expand="block"
              onClick={() =>
                void onError(() =>
                  startDay({
                    programId: program.id,
                    dayTemplateId: planned.dayTemplateId,
                    ...(planned.rotationIndex === null
                      ? {}
                      : { rotationIndex: planned.rotationIndex }),
                  }),
                )
              }
            >
              Start
            </IonButton>
          </div>
        </>
      )}
      <NextLine overview={overview} next={plan.next} />
    </IonList>
  );
}

type Guard = (action: () => Promise<unknown>) => Promise<void>;

function Bodyweight({ overview }: { overview: TodayOverview }) {
  const ctx = useData();
  const [text, setText] = useState('');
  const { error, guard, setError } = useGuard();

  function save() {
    const kg = parseBodyweight(text);
    if (kg === null) {
      setError('Enter your weight in kg.');
      return;
    }
    void guard(async () => {
      await setBodyweight(ctx, ctx.clock.today(), kg);
      setText('');
    });
  }

  return (
    <>
      <IonList inset>
        <IonListHeader>
          <IonLabel>Bodyweight</IonLabel>
        </IonListHeader>
        {overview.bodyweight && (
          <IonItem>
            <IonLabel>{`Saved: ${formatKg(overview.bodyweight.kg)}`}</IonLabel>
          </IonItem>
        )}
        <IonItem>
          <IonInput
            aria-label="Bodyweight today"
            placeholder="Weight in kg"
            inputmode="decimal"
            value={text}
            onIonInput={(e) => setText(e.detail.value ?? '')}
          />
          <IonButton slot="end" fill="clear" onClick={save}>
            Save weight
          </IonButton>
        </IonItem>
      </IonList>
      <ErrorNote error={error} />
    </>
  );
}

export function TodayPage() {
  const today = useToday();
  const overview = useLive(getTodayOverview, [today]);
  const { startEmpty, resume } = useStartWorkout();
  const { error, guard } = useGuard();

  return (
    <PageShell title="Today">
      {overview?.active && (
        <IonList inset>
          <IonItem button detail onClick={resume}>
            <IonLabel>
              <h2>Resume workout</h2>
              <p>{overview.active.session.name}</p>
            </IonLabel>
          </IonItem>
        </IonList>
      )}
      {overview && !overview.active && <PlanCard overview={overview} onError={guard} />}
      <ErrorNote error={error} />
      {overview && !overview.active && (
        <IonList inset>
          {overview.program ? (
            <IonItem routerLink="/tabs/today/pick-day" detail>
              <IonLabel>Start another day</IonLabel>
            </IonItem>
          ) : (
            <IonItem routerLink="/tabs/programs" routerDirection="root" detail>
              <IonLabel>Pick a program</IonLabel>
            </IonItem>
          )}
          <IonItem button detail={false} onClick={() => void guard(startEmpty)}>
            <IonLabel color="primary">Empty workout</IonLabel>
          </IonItem>
        </IonList>
      )}
      {overview && <Bodyweight overview={overview} />}
      {overview?.program && (
        <p className="section-note">
          <IonNote>{overview.program.name}</IonNote>
        </p>
      )}
    </PageShell>
  );
}
