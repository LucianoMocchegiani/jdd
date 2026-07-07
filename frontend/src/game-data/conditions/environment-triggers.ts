/**
 * @file Triggers ambientales — ``shared/game-data/conditions/environment-triggers.json``.
 */

import type { EnvironmentConditionTrigger } from '@/types/condition';
import envData from '@shared/conditions/environment-triggers.json';

/** Export `ENVIRONMENT_CONDITION_TRIGGERS` — environment_condition_triggers. */
export const ENVIRONMENT_CONDITION_TRIGGERS =
  envData.triggers as unknown as readonly EnvironmentConditionTrigger[];
