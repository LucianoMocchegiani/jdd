/**
 * @file Condiciones elementales — ``shared/game-data/conditions/elemental.json``.
 */

import type { ConditionDefinition } from '@/types/condition';
import elementalData from '@shared/conditions/elemental.json';

/** Export `ELEMENTAL_CONDITIONS` — elemental_conditions. */
export const ELEMENTAL_CONDITIONS =
  elementalData.conditions as unknown as readonly ConditionDefinition[];
