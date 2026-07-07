/**
 * @file Catálogo de valores válidos de `medium` (medio de locomoción).
 */

import { isMediumId, MEDIUM_IDS, type Medium } from '@/types/medium';

/** Export `MediumDefinition` — medium definition. */
export interface MediumDefinition {
  description: string;
}

/** Export `MEDIUM_REGISTRY` — medium_registry. */
export const MEDIUM_REGISTRY: Record<Medium, MediumDefinition> = {
  ground: {
    description: 'Apoyado en sólido bajo los pies',
  },
  air: {
    description: 'Sin soporte sólido ni inmersión relevante en fluido/granular',
  },
  submerged_partial: {
    description: 'Parte del cuerpo en fluido o material granular (wading, barro, orillas)',
  },
  submerged_full: {
    description: 'Mayoría del volumen de muestreo en fluido o granular',
  },
};

/** Export `isValidMedium` — is valid medium. */
export function isValidMedium(value: string): value is Medium {
  return isMediumId(value);
}

/** Export `getRegisteredMediums` — get registered mediums. */
export function getRegisteredMediums(): Medium[] {
  return [...MEDIUM_IDS];
}
