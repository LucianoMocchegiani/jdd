/**
 * @file Medio de locomoción: catálogo + reglas de resolución.
 */

export {
  MEDIUM_REGISTRY,
  getRegisteredMediums,
  isValidMedium,
  type MediumDefinition,
} from '@/game-data/medium/registry';
/** Re-export de símbolos del módulo. */
export { MEDIUM_RULES, MEDIUM_RESOLUTION_ORDER } from '@/game-data/medium/rules';
