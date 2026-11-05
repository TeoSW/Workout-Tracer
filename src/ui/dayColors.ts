import type { DayType } from '../domain/schemas';
import { chartColor } from './charts/tokens';

const DAY_TYPE_SLOTS: Record<DayType, number> = {
  hypertrophy: 1,
  strength: 2,
  skill_heavy: 3,
  skill_light: 4,
  dynamics: 5,
  test: 6,
  conditioning: 7,
  custom: 8,
};

export const dayTypeColor = (type: DayType) => chartColor(DAY_TYPE_SLOTS[type]);
