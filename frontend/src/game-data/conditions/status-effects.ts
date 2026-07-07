/**
 * @file Condiciones de estado — ``shared/game-data/conditions/status-effects.json``.
 */

import type { ConditionDefinition } from '@/types/condition';
import statusData from '@shared/conditions/status-effects.json';

/** Export `STATUS_EFFECT_CONDITIONS` — status_effect_conditions. */
export const STATUS_EFFECT_CONDITIONS =
  statusData.conditions as unknown as readonly ConditionDefinition[];
