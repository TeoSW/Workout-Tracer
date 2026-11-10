import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useState } from 'react';
import { useData, useLive, useToday } from '../../app/DataProvider';
import { setBodyweight } from '../../data/bodyweight';
import { undoMissedDay } from '../../data/missed-days';
import { getTodayOverview, type TodayOverview } from '../../data/today';
import { parseBodyweight } from '../../domain/bodyweight';
import { isDeloadDay } from '../../domain/deload';
import { formatCycleWeek, formatKg, formatWeekdayDate } from '../../domain/format';
import type { PlannedDay } from '../../domain/today';
import { MISSED_REASON_LABELS } from '../../ui/labels';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';
import { BackupReminder } from './BackupReminder';
import { InstallBanner } from './InstallBanner';
import { NotTodaySheet } from './NotTodaySheet';
import { useStartWorkout } from './useStartWorkout';

type Guard = (action: () => Promise<unknown>) => Promise<void>;

function nameOf(overview: TodayOverview, dayTemplateId: string | null): string {
  return overview.days.find((d) => d.id === dayTemplateId)?.name ?? 'Workout';
}

function nextLine(overview: TodayOverview, next: PlannedDay | null): string | null {
  if (!next) return null;
  const when = next.date === null ? '' : `, ${formatWeekdayDate(next.date)}`;
  return `Next: ${nameOf(overview, next.dayTemplateId)}${when}`;
}

/** The one card at the top: what today is, and the one thing to do about it. */
function TodayCard({ overview, onError }: { overview: TodayOverview; onError: Guard }) {
  const ctx = useData();
  const { startDay } = useStartWorkout();
  const [skipping, setSkipping] = useState(false);
  const { plan, program } = overview;
  if (!plan || !program) return null;
  const { today, cycle } = plan;
  const planned = today.status === 'planned' ? today.day : null;
  const day = overview.days.find((d) => d.id === planned?.dayTemplateId);
  const deload = day !== undefined && isDeloadDay(program, day, ctx.clock.today());
  const missed =
    today.status === 'missed' ? overview.missedDays.find((m) => m.id === today.missedDayId) : null;
  const next = nextLine(overview, plan.next);

  let title: string;
  if (today.status === 'rest') title = 'Rest day';
  else if (today.status === 'done') title = `Done: ${nameOf(overview, today.dayTemplateId)}`;
  else if (today.status === 'missed') title = `Missed: ${nameOf(overview, today.dayTemplateId)}`;
  else title = nameOf(overview, planned?.dayTemplateId ?? null);

  const missedDetail = missed
    ? [missed.reason === null ? null : MISSED_REASON_LABELS[missed.reason], missed.note || null]
        .filter((part) => part !== null)
        .join(', ')
    : '';

  return (
    <section className="today-card" aria-label="Today's plan">
      {cycle && (
        <div className="today-card-kicker">
          <span>{formatCycleWeek(cycle.cycleWeek, cycle.cycleWeeks)}</span>
          {deload && <IonBadge color="warning">Deload</IonBadge>}
        </div>
      )}
      <h2 className="today-card-title">{title}</h2>
      {missedDetail !== '' && <p className="today-card-line">{missedDetail}</p>}
      {planned && (
        <>
          <p className="today-card-line">Training today?</p>
          <IonButton
            expand="block"
            size="large"
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
          <IonButton expand="block" fill="clear" onClick={() => setSkipping(true)}>
            Not today
          </IonButton>
          <NotTodaySheet
            open={skipping}
            dayName={nameOf(overview, planned.dayTemplateId)}
            onClose={() => setSkipping(false)}
          />
        </>
      )}
      {missed && (
        <IonButton
          fill="clear"
          size="small"
          className="today-card-undo"
          onClick={() => void onError(() => undoMissedDay(ctx, missed.id))}
        >
          Undo
        </IonButton>
      )}
      {next && <p className="today-card-next">{next}</p>}
    </section>
  );
}

function BodyweightRow({ overview }: { overview: TodayOverview }) {
  const ctx = useData();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { error, guard, setError } = useGuard();

  function close() {
    setText('');
    setError(null);
    setOpen(false);
  }

  function save() {
    const kg = parseBodyweight(text);
    if (kg === null) {
      setError('Enter your weight in kg.');
      return;
    }
    void guard(async () => {
      await setBodyweight(ctx, ctx.clock.today(), kg);
      close();
    });
  }

  return (
    <>
      <IonList inset>
        <IonItem button detail onClick={() => setOpen(true)}>
          <IonLabel>Bodyweight</IonLabel>
          <IonNote slot="end">
            {overview.bodyweight ? formatKg(overview.bodyweight.kg) : 'Add today'}
          </IonNote>
        </IonItem>
      </IonList>
      <IonModal isOpen={open} breakpoints={[0, 0.4]} initialBreakpoint={0.4} onDidDismiss={close}>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={close}>Cancel</IonButton>
            </IonButtons>
            <IonTitle>Bodyweight</IonTitle>
            <IonButtons slot="end">
              <IonButton strong onClick={save}>
                Save weight
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonList inset>
            <IonItem>
              <IonInput
                aria-label="Bodyweight today"
                placeholder="Weight in kg"
                inputmode="decimal"
                value={text}
                onIonInput={(e) => setText(e.detail.value ?? '')}
              />
            </IonItem>
          </IonList>
          <ErrorNote error={error} />
        </IonContent>
      </IonModal>
    </>
  );
}

export function TodayPage() {
  const today = useToday();
  const overview = useLive(getTodayOverview, [today]);
  const { startEmpty, resume } = useStartWorkout();
  const { error, guard } = useGuard();
  const idle = overview !== undefined && overview.active === null;

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
      {idle && <TodayCard overview={overview} onError={guard} />}
      <ErrorNote error={error} />
      {idle && (
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
      {overview && <BodyweightRow overview={overview} />}
      {idle && <BackupReminder today={today} />}
      <InstallBanner />
      {overview?.program && (
        <p className="section-note">
          <IonNote>{overview.program.name}</IonNote>
        </p>
      )}
    </PageShell>
  );
}
