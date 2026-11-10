import type { SplitType } from '../../schemas';
import { REST_WEEK } from '../builders';
import { CALISTHENICS_5_WEEK } from './calisthenics-5-week';
import {
  BEGINNER_CALISTHENICS,
  MINIMAL_2_DAYS,
  SKILL_STRENGTH_4_WEEK,
} from './calisthenics-presets';
import { FULL_BODY, PUSH_PULL_LEGS, UPPER_LOWER } from './generic';
import { PROGRAM_A } from './program-a';
import { PROGRAM_B } from './program-b';
import { PROGRAM_C } from './program-c';
import type { BuiltInTemplate } from './types';

export type { BuiltInTemplate } from './types';
export {
  BEGINNER_CALISTHENICS,
  CALISTHENICS_5_WEEK,
  FULL_BODY,
  MINIMAL_2_DAYS,
  PROGRAM_A,
  PROGRAM_B,
  PROGRAM_C,
  PUSH_PULL_LEGS,
  SKILL_STRENGTH_4_WEEK,
  UPPER_LOWER,
};

/** In the order the Presets list shows them. */
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  CALISTHENICS_5_WEEK,
  PROGRAM_C,
  SKILL_STRENGTH_4_WEEK,
  BEGINNER_CALISTHENICS,
  MINIMAL_2_DAYS,
  PROGRAM_A,
  PROGRAM_B,
  FULL_BODY,
  UPPER_LOWER,
  PUSH_PULL_LEGS,
];

export function blankTemplate(splitType: SplitType): BuiltInTemplate {
  return {
    id: `tpl-blank-${splitType}`,
    name: 'Blank',
    splitType,
    schedule: { kind: 'weekday', weeks: [{ ...REST_WEEK }] },
    cycleWeeks: 1,
    deloadWeeks: [],
    note: '',
    dayTemplates: [],
  };
}

/** What the new program flow offers after a split type is picked. */
export function templatesForSplit(splitType: SplitType): BuiltInTemplate[] {
  return [...BUILT_IN_TEMPLATES.filter((t) => t.splitType === splitType), blankTemplate(splitType)];
}
