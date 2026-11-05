import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { arrowDown, arrowUp, close } from 'ionicons/icons';
import { useState } from 'react';
import { WEEKDAYS, type Weekday } from '../../domain/dates';
import {
  addRotationDay,
  convertSchedule,
  moveRotationEntry,
  removeRotationEntry,
  resizeCycle,
  setGridDay,
  toggleDeloadWeek,
} from '../../domain/program-edit';
import type { DayTemplate, Program, RotationSchedule, WeekdaySchedule } from '../../domain/schemas';
import { Stepper } from '../../ui/Stepper';

const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

type Props = {
  program: Program;
  days: DayTemplate[];
  /** Saves an edit. An edit that breaks a rule throws, and the caller shows the error. */
  onChange: (build: () => Program) => void;
};

function DeloadWeeks({ program, onChange }: Pick<Props, 'program' | 'onChange'>) {
  if (program.cycleWeeks === null) return null;
  const weeks = Array.from({ length: program.cycleWeeks }, (_, i) => i + 1);
  return weeks.map((week) => (
    <IonItem key={week}>
      <IonToggle
        aria-label={`Deload in week ${week}`}
        checked={program.deloadWeeks.includes(week)}
        onIonChange={() => onChange(() => toggleDeloadWeek(program, week))}
      >
        Deload in week {week}
      </IonToggle>
    </IonItem>
  ));
}

function WeekdayGrid(props: Props & { schedule: WeekdaySchedule }) {
  const { program, days, schedule, onChange } = props;
  const [weekIndex, setWeekIndex] = useState(0);
  const shown = Math.min(weekIndex, schedule.weeks.length - 1);
  const week = schedule.weeks[shown];
  return (
    <>
      <Stepper
        label="Cycle length"
        noun="cycle weeks"
        unit=" weeks"
        value={program.cycleWeeks ?? 1}
        min={1}
        max={26}
        onChange={(n) => onChange(() => resizeCycle(program, n))}
      />
      <DeloadWeeks program={program} onChange={onChange} />
      <IonItem>
        <IonSelect
          aria-label="Showing week"
          label="Showing week"
          interface="action-sheet"
          value={shown + 1}
          onIonChange={(e) => setWeekIndex(Number(e.detail.value) - 1)}
        >
          {schedule.weeks.map((_, i) => (
            <IonSelectOption key={i} value={i + 1}>
              Week {i + 1}
            </IonSelectOption>
          ))}
        </IonSelect>
      </IonItem>
      {WEEKDAYS.map((weekday) => (
        <IonItem key={weekday}>
          <IonSelect
            aria-label={WEEKDAY_LABELS[weekday]}
            label={WEEKDAY_LABELS[weekday]}
            interface="action-sheet"
            value={week?.[weekday] ?? 'rest'}
            onIonChange={(e) => {
              const value = e.detail.value as string;
              onChange(() => setGridDay(program, shown, weekday, value === 'rest' ? null : value));
            }}
          >
            <IonSelectOption value="rest">Rest</IonSelectOption>
            {days.map((d) => (
              <IonSelectOption key={d.id} value={d.id}>
                {d.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      ))}
    </>
  );
}

function Rotation(props: Props & { schedule: RotationSchedule }) {
  const { program, days, schedule, onChange } = props;
  const nameOf = (id: string) => days.find((d) => d.id === id)?.name ?? 'Missing day';
  const withSessions = (sessionsPerWeek: number): Program => ({
    ...program,
    schedule: { ...schedule, sessionsPerWeek },
  });
  return (
    <>
      {schedule.sequence.map((id, index) => (
        <IonItem key={`${id}-${index}`}>
          <IonLabel>
            {index + 1}. {nameOf(id)}
          </IonLabel>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={`Move ${nameOf(id)} up`}
            disabled={index === 0}
            onClick={() => onChange(() => moveRotationEntry(program, index, 'up'))}
          >
            <IonIcon slot="icon-only" icon={arrowUp} aria-hidden="true" />
          </IonButton>
          <IonButton
            slot="end"
            fill="clear"
            aria-label={`Move ${nameOf(id)} down`}
            disabled={index === schedule.sequence.length - 1}
            onClick={() => onChange(() => moveRotationEntry(program, index, 'down'))}
          >
            <IonIcon slot="icon-only" icon={arrowDown} aria-hidden="true" />
          </IonButton>
          <IonButton
            slot="end"
            fill="clear"
            color="medium"
            aria-label={`Remove ${nameOf(id)} from the rotation`}
            onClick={() => onChange(() => removeRotationEntry(program, index))}
          >
            <IonIcon slot="icon-only" icon={close} aria-hidden="true" />
          </IonButton>
        </IonItem>
      ))}
      <IonItem>
        <IonSelect
          aria-label="Add to rotation"
          label="Add to rotation"
          interface="action-sheet"
          value={null}
          onIonChange={(e) => {
            const id = e.detail.value as string | null;
            if (id) onChange(() => addRotationDay(program, id));
          }}
        >
          {days.map((d) => (
            <IonSelectOption key={d.id} value={d.id}>
              {d.name}
            </IonSelectOption>
          ))}
        </IonSelect>
      </IonItem>
      <Stepper
        label="Sessions per week"
        noun="sessions"
        value={schedule.sessionsPerWeek}
        min={1}
        max={7}
        onChange={(n) => onChange(() => withSessions(n))}
      />
      <Stepper
        label="Cycle length"
        noun="cycle weeks"
        unit={program.cycleWeeks === null ? '' : ' weeks'}
        value={program.cycleWeeks ?? 0}
        min={0}
        max={26}
        onChange={(n) => onChange(() => resizeCycle(program, n === 0 ? null : n))}
      />
      <DeloadWeeks program={program} onChange={onChange} />
    </>
  );
}

export function ScheduleEditor(props: Props) {
  const { program, days, onChange } = props;
  const { schedule } = program;
  return (
    <IonList inset>
      <IonListHeader>
        <IonLabel>Schedule</IonLabel>
      </IonListHeader>
      <IonItem>
        <IonSegment
          aria-label="Schedule type"
          value={schedule.kind}
          onIonChange={(e) => {
            const kind = e.detail.value as Program['schedule']['kind'];
            onChange(() =>
              convertSchedule(
                program,
                kind,
                days.map((d) => d.id),
              ),
            );
          }}
        >
          <IonSegmentButton value="weekday">
            <IonLabel>Weekdays</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="rotation">
            <IonLabel>Rotation</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </IonItem>
      {schedule.kind === 'weekday' ? (
        <WeekdayGrid {...props} schedule={schedule} />
      ) : (
        <Rotation {...props} schedule={schedule} />
      )}
    </IonList>
  );
}
