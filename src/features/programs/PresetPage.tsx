import {
  IonButton,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  useIonRouter,
} from '@ionic/react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadBandMap } from '../../data/bands';
import { loadExerciseMap } from '../../data/exercises';
import { createProgramFromTemplate, startFromPreset } from '../../data/programs';
import type { Weekday } from '../../domain/dates';
import { BUILT_IN_TEMPLATES } from '../../domain/fixtures/templates';
import { formatPlanLine } from '../../domain/format';
import { presetSummary, presetWeeks } from '../../domain/preset-summary';
import { PageShell } from '../../ui/PageShell';
import { Stepper } from '../../ui/Stepper';
import { ErrorNote, useGuard } from '../../ui/useGuard';

const WEEKDAY_SHORT: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

async function loadLibrary(ctx: Parameters<typeof loadExerciseMap>[0]) {
  const [exercises, bands] = await Promise.all([loadExerciseMap(ctx), loadBandMap(ctx)]);
  return { exercises, bands };
}

/** A preset before it becomes a program: its calendar, its days, and one button to use it. */
export function PresetPage() {
  const ctx = useData();
  const router = useIonRouter();
  const { id } = useParams();
  const template = BUILT_IN_TEMPLATES.find((t) => t.id === id);
  const library = useLive(loadLibrary);
  const [week, setWeek] = useState(1);
  const { error, guard } = useGuard();

  if (!template) {
    return (
      <PageShell title="Preset" back="/tabs/programs/new">
        <p className="empty-note">This preset no longer exists.</p>
      </PageShell>
    );
  }
  const cycleWeeks = template.cycleWeeks ?? 1;
  const weeks = presetWeeks(template);

  function use() {
    if (!template) return;
    void guard(async () => {
      await startFromPreset(ctx, template, week);
      router.push('/tabs/today', 'root', 'replace');
    });
  }

  function editFirst() {
    if (!template) return;
    void guard(async () => {
      const { program } = await createProgramFromTemplate(ctx, template);
      router.push(`/tabs/programs/${program.id}`, 'forward', 'replace');
    });
  }

  return (
    <PageShell title={template.name} back="/tabs/programs/new">
      <p className="section-note sheet-intro">{presetSummary(template)}</p>
      {template.note !== '' && (
        <IonList inset>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <p className="preset-note">{template.note}</p>
            </IonLabel>
          </IonItem>
        </IonList>
      )}

      {weeks.map((w) => (
        <IonList inset key={w.label}>
          <IonListHeader>
            <IonLabel>{w.label}</IonLabel>
          </IonListHeader>
          {w.days.map((d) => (
            <IonItem key={d.weekday}>
              <IonNote slot="start" className="preset-weekday">
                {WEEKDAY_SHORT[d.weekday]}
              </IonNote>
              <IonLabel className="ion-text-wrap">{d.dayName}</IonLabel>
            </IonItem>
          ))}
        </IonList>
      ))}
      {template.schedule.kind === 'rotation' && (
        <IonList inset>
          <IonListHeader>
            <IonLabel>Order</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              {template.schedule.sequence
                .map((dayId) => template.dayTemplates.find((d) => d.id === dayId)?.name ?? '')
                .join(', then ')}
            </IonLabel>
          </IonItem>
        </IonList>
      )}

      {template.dayTemplates.map((day) => (
        <IonList inset key={day.id}>
          <IonListHeader>
            <IonLabel>{day.name}</IonLabel>
          </IonListHeader>
          {day.blocks.map((block) => {
            const exercise =
              block.kind === 'exercise' ? library?.exercises.get(block.exerciseId) : undefined;
            const title = block.kind === 'choice' ? block.choiceSlot.label : exercise?.name;
            return (
              <IonItem key={block.id}>
                <IonLabel className="ion-text-wrap">
                  <h3>{title ?? ''}</h3>
                  {exercise && library && block.kind === 'exercise' && (
                    <p>{formatPlanLine(block, exercise, library.bands)}</p>
                  )}
                  {block.kind === 'choice' && (
                    <p>
                      {block.choiceSlot.options
                        .map((o) => library?.exercises.get(o.exerciseId)?.name ?? '')
                        .join(' or ')}
                    </p>
                  )}
                </IonLabel>
              </IonItem>
            );
          })}
        </IonList>
      ))}

      <div className="preset-actions">
        {cycleWeeks > 1 && (
          <IonList inset>
            <Stepper
              label="Start in week"
              noun="weeks"
              value={week}
              min={1}
              max={cycleWeeks}
              onChange={(value) => setWeek(value)}
            />
          </IonList>
        )}
        <div className="ion-padding">
          <IonButton expand="block" size="large" onClick={use}>
            Use this program
          </IonButton>
          <IonButton expand="block" fill="clear" onClick={editFirst}>
            Edit before using
          </IonButton>
        </div>
        <ErrorNote error={error} />
      </div>
    </PageShell>
  );
}
