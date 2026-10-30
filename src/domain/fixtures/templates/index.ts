import type { SplitType } from '../../schemas';
import { REST_WEEK } from '../builders';
import { FULL_BODY, PUSH_PULL_LEGS, UPPER_LOWER } from './generic';
import { PROGRAM_A } from './program-a';
import { PROGRAM_B } from './program-b';
import { PROGRAM_C } from './program-c';
import type { BuiltInTemplate } from './types';

export type { BuiltInTemplate } from './types';
export { FULL_BODY, PROGRAM_A, PROGRAM_B, PROGRAM_C, PUSH_PULL_LEGS, UPPER_LOWER };

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  PROGRAM_A,
  PROGRAM_B,
  PROGRAM_C,
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
