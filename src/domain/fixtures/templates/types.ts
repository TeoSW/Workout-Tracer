import type { DayTemplate, Schedule, SplitType } from '../../schemas';

/** A read-only starting point. It is copied into a user program, never edited in place. */
export type BuiltInTemplate = {
  id: string;
  name: string;
  splitType: SplitType;
  schedule: Schedule;
  cycleWeeks: number | null;
  deloadWeeks: number[];
  note: string;
  dayTemplates: DayTemplate[];
};
