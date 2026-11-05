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
  useIonRouter,
} from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useData, useLive } from '../../app/DataProvider';
import { loadExerciseMap } from '../../data/exercises';
import { getProgram } from '../../data/programs';
import { getSessionView, type SessionView } from '../../data/sessions';
import { saveTestResults, type TestResultInput } from '../../data/test-results';
import { programChoiceSlots } from '../../domain/choice';
import type { ChoiceSlot, Exercise } from '../../domain/schemas';
import { bestCleanHoldInSession } from '../../domain/skills';
import { PageShell } from '../../ui/PageShell';
import { ErrorNote, useGuard } from '../../ui/useGuard';

const TODAY = '/tabs/today';

function initialResults(
  view: SessionView,
  exercises: ReadonlyMap<string, Exercise>,
): TestResultInput[] {
  const sets = view.exercises.flatMap((e) => e.sets);
  const holdIds = view.exercises
    .map((e) => e.exerciseId)
    .filter((id) => exercises.get(id)?.trackingType === 'hold');
  return [...new Set(holdIds)].map((exerciseId) => {
    const best = bestCleanHoldInSession(sets, exerciseId);
    return {
      exerciseId,
      progressionLevel: best?.progressionLevel ?? null,
      bestHoldSec: best?.seconds ?? null,
      note: '',
    };
  });
}

function TestForm(props: {
  view: SessionView;
  exercises: ReadonlyMap<string, Exercise>;
  slots: ChoiceSlot[];
}) {
  const { view, exercises, slots } = props;
  const ctx = useData();
  const router = useIonRouter();
  const { error, guard } = useGuard();
  const [results, setResults] = useState(() => initialResults(view, exercises));
  const [picks, setPicks] = useState<Record<string, number>>({});
  const change = (index: number, patch: Partial<TestResultInput>) =>
    setResults((all) => all.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  function save() {
    const choices = slots.flatMap((slot) => {
      const optionIndex = picks[slot.id];
      return optionIndex === undefined ? [] : [{ slotId: slot.id, optionIndex }];
    });
    void guard(async () => {
      await saveTestResults(ctx, { sessionId: view.session.id, results, choices });
      router.push(TODAY, 'back', 'replace');
    });
  }

  return (
    <PageShell title="Test results" back={TODAY}>
      {results.map((result, index) => {
        const exercise = exercises.get(result.exerciseId);
        return (
          <IonList inset key={result.exerciseId}>
            <IonListHeader>
              <IonLabel>{exercise?.name ?? result.exerciseId}</IonLabel>
            </IonListHeader>
            <IonItem>
              <IonInput
                aria-label={`${exercise?.name} best clean hold`}
                label="Best clean hold (s)"
                inputmode="decimal"
                value={result.bestHoldSec ?? ''}
                onIonInput={(e) => {
                  const text = (e.detail.value ?? '').trim();
                  const seconds = Number(text);
                  change(index, {
                    bestHoldSec: text === '' || !Number.isFinite(seconds) ? null : seconds,
                  });
                }}
              />
            </IonItem>
            {exercise?.progressionLadder && (
              <IonItem>
                <IonSelect
                  aria-label={`${exercise.name} level`}
                  label="Level"
                  interface="action-sheet"
                  value={result.progressionLevel ?? 'none'}
                  onIonChange={(e) => {
                    const value = e.detail.value as string;
                    change(index, { progressionLevel: value === 'none' ? null : value });
                  }}
                >
                  <IonSelectOption value="none">Not set</IonSelectOption>
                  {exercise.progressionLadder.map((level) => (
                    <IonSelectOption key={level} value={level}>
                      {level}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            )}
            <IonItem>
              <IonTextarea
                aria-label={`${exercise?.name} note`}
                label="Note"
                labelPlacement="stacked"
                autoGrow
                value={result.note}
                onIonInput={(e) => change(index, { note: e.detail.value ?? '' })}
              />
            </IonItem>
          </IonList>
        );
      })}

      {slots.map((slot) => (
        <IonList inset key={slot.id}>
          <IonListHeader>
            <IonLabel>Next cycle: {slot.label}</IonLabel>
          </IonListHeader>
          {slot.options.map((option, index) => (
            <IonItem
              key={option.exerciseId}
              button
              detail={false}
              onClick={() => setPicks({ ...picks, [slot.id]: index })}
            >
              <IonLabel className="ion-text-wrap">
                <h2>{exercises.get(option.exerciseId)?.name ?? option.exerciseId}</h2>
                <p>{option.pickWhen}</p>
              </IonLabel>
              {picks[slot.id] === index && (
                <IonIcon slot="end" icon={checkmark} aria-label="Selected" />
              )}
            </IonItem>
          ))}
        </IonList>
      ))}

      <ErrorNote error={error} />
      <div className="ion-padding">
        <IonButton expand="block" onClick={save}>
          Save results
        </IonButton>
      </div>
    </PageShell>
  );
}

export function TestFlowPage() {
  const { id = '' } = useParams();
  const view = useLive((c) => getSessionView(c, id), [id]);
  const exercises = useLive(loadExerciseMap);
  const programId = view?.session.programId ?? null;
  const loaded = useLive(
    (c) => (programId ? getProgram(c, programId) : Promise.resolve(null)),
    [programId],
  );

  if (!view || !exercises || loaded === undefined) {
    return <PageShell title="Test results" back={TODAY} children={null} />;
  }
  return (
    <TestForm
      key={id}
      view={view}
      exercises={exercises}
      slots={programChoiceSlots(loaded?.dayTemplates ?? [])}
    />
  );
}
