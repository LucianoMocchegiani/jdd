/**
 * @file Acciones (habilidades): fichas + registry + validación.
 */

export {
  CONSTANT_DISPLACEMENT_ACTION_ORDER,
  CONSTANT_DISPLACEMENT_ACTIONS,
  IMPULSE_DISPLACEMENT_ACTIONS,
} from '@/game-data/actions/constant-displacements';
/** Re-export de símbolos del módulo. */
export { BODY_ACTIONS } from '@/game-data/actions/body-actions';
/** Re-export de símbolos del módulo. */
export { ALL_ACTIONS, getActionById } from '@/game-data/actions/registry';
export {
  validateActionRegistry,
  type ActionRegistryValidationResult,
} from '@/game-data/actions/validate';
