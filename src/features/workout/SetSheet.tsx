import {
  IonButton,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import { RIR_VALUES, RPE_VALUES, effortModeFor, rirToRpe, rpeToRir } from '../../domain/effort';
import type { Band, EffortMode, Exercise, LoggedSet } from '../../domain/schemas';
import type { SetDraft } from '../../domain/set-draft';
import { draftProblem } from '../../domain/set-draft';
import { ErrorNote } from '../../ui/useGuard';
import { Stepper } from '../../ui/Stepper';

type Change = (patch: Partial<SetDraft>) => void;

function Chips<T>(props: {
  options: readonly T[];
  label: (value: T) => string;
  isOn: (value: T) => boolean;
  onTap: (value: T) => void;
}) {
  return (
    <div className="chip-row">
      {props.options.map((value) => {
        const on = props.isOn(value);
        return (
          <IonChip
            key={props.label(value)}
            color={on ? 'primary' : 'medium'}
            outline={!on}
            aria-pressed={on}
            onClick={() => props.onTap(value)}
          >
            {props.label(value)}
          </IonChip>
        );
      })}
    </div>
  );
}

function EffortChips({
  draft,
  mode,
  onChange,
}: {
  draft: SetDraft;
  mode: EffortMode;
  onChange: Change;
}) {
  if (mode === 'off') return null;
  const isRpe = mode === 'rpe';
  const selected = draft.rir === null ? null : isRpe ? rirToRpe(draft.rir) : draft.rir;
  return (
    <Chips
      options={isRpe ? RPE_VALUES : RIR_VALUES}
      label={(v) => `${isRpe ? 'RPE' : 'RIR'} ${v}`}
      isOn={(v) => v === selected}
      onTap={(v) => {
        const rir = isRpe ? rpeToRir(v) : v;
        onChange({ rir: draft.rir === rir ? null : rir });
      }}
    />
  );
}

function BandChips({
  bands,
  draft,
  onChange,
}: {
  bands: Band[];
  draft: SetDraft;
  onChange: Change;
}) {
  const shown = bands.filter((b) => !b.archived || draft.bandIds.includes(b.id));
  if (shown.length === 0) return null;
  return (
    <Chips
      options={shown}
      label={(b) => `Band ${b.label}`}
      isOn={(b) => draft.bandIds.includes(b.id)}
      onTap={(b) =>
        onChange({
          bandIds: draft.bandIds.includes(b.id)
            ? draft.bandIds.filter((id) => id !== b.id)
            : [...draft.bandIds, b.id],
          addedKg: undefined,
        })
      }
    />
  );
}

function LevelAndClean(props: { exercise: Exercise; draft: SetDraft; onChange: Change }) {
  const { exercise, draft, onChange } = props;
  return (
    <>
      {exercise.progressionLadder && (
        <IonItem>
          <IonSelect
            aria-label="Level"
            label="Level"
            interface="action-sheet"
            value={draft.progressionLevel ?? 'none'}
            onIonChange={(e) => {
              const value = e.detail.value as string;
              onChange({ progressionLevel: value === 'none' ? undefined : value });
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
        <IonToggle
          aria-label="Clean"
          checked={draft.clean}
          onIonChange={(e) => onChange({ clean: e.detail.checked })}
        >
          Clean
        </IonToggle>
      </IonItem>
    </>
  );
}

/** Start and stop fill in the seconds. They stay editable below. */
function Stopwatch(props: { nowMs: () => number; onStop: (seconds: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { nowMs, onStop } = props;

  useEffect(() => {
    if (startedAt === null) return undefined;
    const tick = setInterval(() => setElapsed((nowMs() - startedAt) / 1000), 100);
    return () => clearInterval(tick);
  }, [startedAt, nowMs]);

  function toggle() {
    if (startedAt === null) {
      setElapsed(0);
      setStartedAt(nowMs());
      return;
    }
    const seconds = Math.round((nowMs() - startedAt) / 1000);
    setStartedAt(null);
    setElapsed(seconds);
    onStop(seconds);
  }

  return (
    <>
      <div className="stopwatch" role="timer">
        {elapsed.toFixed(1)}s
      </div>
      <div className="ion-padding-horizontal">
        <IonButton expand="block" fill="outline" onClick={toggle}>
          {startedAt === null ? 'Start timer' : 'Stop timer'}
        </IonButton>
      </div>
    </>
  );
}

function AttemptFields({ draft, onChange }: { draft: SetDraft; onChange: Change }) {
  // Each tap is remembered so undo takes back the right kind.
  const taps = useRef<boolean[]>([]);
  const tap = (clean: boolean) => {
    taps.current.push(clean);
    onChange({
      attempts: draft.attempts + 1,
      cleanAttempts: draft.cleanAttempts + (clean ? 1 : 0),
    });
  };
  const undo = () => {
    const last = taps.current.pop();
    if (last === undefined) return;
    onChange({ attempts: draft.attempts - 1, cleanAttempts: draft.cleanAttempts - (last ? 1 : 0) });
  };
  return (
    <>
      <div className="stopwatch">
        {draft.cleanAttempts} of {draft.attempts} clean
      </div>
      <div className="ion-padding-horizontal">
        <IonButton expand="block" onClick={() => tap(true)}>
          + clean
        </IonButton>
        <IonButton expand="block" fill="outline" onClick={() => tap(false)}>
          + miss
        </IonButton>
        <IonButton expand="block" fill="clear" onClick={undo}>
          Undo
        </IonButton>
      </div>
    </>
  );
}

function Fields(props: {
  exercise: Exercise;
  draft: SetDraft;
  bands: Band[];
  effortMode: EffortMode;
  nowMs: () => number;
  onChange: Change;
}) {
  const { exercise, draft, bands, effortMode, nowMs, onChange } = props;
  const reps = (
    <Stepper
      label="Reps"
      value={draft.reps ?? 0}
      editable
      onChange={(value) => onChange({ reps: Math.round(value) })}
    />
  );
  const mode = effortModeFor(effortMode, exercise);
  const effort = <EffortChips draft={draft} mode={mode} onChange={onChange} />;

  switch (exercise.trackingType) {
    case 'weight_reps':
      return (
        <IonList>
          <Stepper
            label="Kg"
            noun="kg"
            step={2.5}
            value={draft.kg ?? 0}
            editable
            onChange={(kg) => onChange({ kg })}
          />
          {reps}
          {effort}
        </IonList>
      );
    case 'bodyweight_reps':
      return (
        <IonList>
          {reps}
          <Stepper
            label="Added kg"
            noun="added kg"
            step={2.5}
            value={draft.addedKg ?? 0}
            editable
            onChange={(addedKg) =>
              onChange(addedKg > 0 ? { addedKg, bandIds: [] } : { addedKg: undefined })
            }
          />
          <BandChips bands={bands} draft={draft} onChange={onChange} />
          {effort}
        </IonList>
      );
    case 'hold':
      return (
        <IonList>
          <Stopwatch nowMs={nowMs} onStop={(seconds) => onChange({ seconds })} />
          <Stepper
            label="Seconds"
            value={draft.seconds ?? 0}
            editable
            onChange={(seconds) => onChange({ seconds })}
          />
          <BandChips bands={bands} draft={draft} onChange={onChange} />
          <LevelAndClean exercise={exercise} draft={draft} onChange={onChange} />
        </IonList>
      );
    case 'complex':
      return (
        <IonList>
          {draft.parts.map((part, index) => (
            <Stepper
              key={part.name}
              label={part.unit === 'seconds' ? `${part.name} seconds` : part.name}
              noun={part.name.toLowerCase()}
              value={part.value}
              onChange={(value) =>
                onChange({
                  parts: draft.parts.map((p, i) => (i === index ? { ...p, value } : p)),
                })
              }
            />
          ))}
          <BandChips bands={bands} draft={draft} onChange={onChange} />
          <LevelAndClean exercise={exercise} draft={draft} onChange={onChange} />
        </IonList>
      );
    case 'attempts':
      return <AttemptFields draft={draft} onChange={onChange} />;
    case 'checklist':
      return null;
  }
}

export type SheetSet = { set: LoggedSet; exercise: Exercise; draft: SetDraft; title: string };

/** The bottom sheet for one set. A repeat set is one tap on Done. */
export function SetSheet(props: {
  open: SheetSet | null;
  bands: Band[];
  effortMode: EffortMode;
  nowMs: () => number;
  onDone: (open: SheetSet, draft: SetDraft) => void;
  onClose: () => void;
}) {
  const { open, onClose } = props;
  return (
    <IonModal
      isOpen={open !== null}
      breakpoints={[0, 0.75, 1]}
      initialBreakpoint={0.75}
      onDidDismiss={onClose}
    >
      {open && <SheetBody key={open.set.id} {...props} open={open} />}
    </IonModal>
  );
}

function SheetBody(props: {
  open: SheetSet;
  bands: Band[];
  effortMode: EffortMode;
  nowMs: () => number;
  onDone: (open: SheetSet, draft: SetDraft) => void;
}) {
  const { open, bands, effortMode, nowMs, onDone } = props;
  const [draft, setDraft] = useState(open.draft);
  const [error, setError] = useState<string | null>(null);
  const change: Change = (patch) => {
    setError(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  function done() {
    const problem = draftProblem(draft, open.exercise);
    if (problem) setError(problem);
    else onDone(open, draft);
  }

  return (
    <>
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            <IonLabel>{open.title}</IonLabel>
          </IonTitle>
          <IonButton slot="end" fill="clear" strong data-testid="sheet-done" onClick={done}>
            Done
          </IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="set-sheet">
          <Fields
            exercise={open.exercise}
            draft={draft}
            bands={bands}
            effortMode={effortMode}
            nowMs={nowMs}
            onChange={change}
          />
          <ErrorNote error={error} />
        </div>
      </IonContent>
    </>
  );
}
