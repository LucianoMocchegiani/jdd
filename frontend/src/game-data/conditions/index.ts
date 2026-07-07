/**
 * @file Condiciones: fichas + registry + triggers ambientales + validación.
 */

export { STATUS_EFFECT_CONDITIONS } from '@/game-data/conditions/status-effects';
/** Re-export de símbolos del módulo. */
export { ELEMENTAL_CONDITIONS } from '@/game-data/conditions/elemental';
/** Re-export de símbolos del módulo. */
export { ENVIRONMENT_CONDITION_TRIGGERS } from '@/game-data/conditions/environment-triggers';
export {
  ALL_CONDITIONS,
  getConditionById,
  isKnownConditionId,
} from '@/game-data/conditions/registry';
export {
  validateConditionRegistry,
  type ConditionRegistryValidationResult,
} from '@/game-data/conditions/validate';
