/**
 * @file Registro unificado de condiciones (plantillas declarativas).
 */

import { ELEMENTAL_CONDITIONS } from '@/game-data/conditions/elemental';
import { STATUS_EFFECT_CONDITIONS } from '@/game-data/conditions/status-effects';
import type { ConditionDefinition } from '@/types/condition';

/** Export `ALL_CONDITIONS` — all_conditions. */
export const ALL_CONDITIONS: readonly ConditionDefinition[] = [
  ...STATUS_EFFECT_CONDITIONS,
  ...ELEMENTAL_CONDITIONS,
];

const BY_ID = new Map(ALL_CONDITIONS.map((c) => [c.id, c]));

/** Export `getConditionById` — get condition by id. */
export function getConditionById(id: string): ConditionDefinition | undefined {
  return BY_ID.get(id);
}

/** Export `isKnownConditionId` — is known condition id. */
export function isKnownConditionId(id: string): boolean {
  return BY_ID.has(id);
}
