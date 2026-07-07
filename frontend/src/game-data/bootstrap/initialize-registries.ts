/**
 * @file Arranque de catálogos en memoria (fase 1+).
 */

import { validateActionRegistry } from '@/game-data/actions/validate';
import { validateConditionRegistry } from '@/game-data/conditions/validate';
import { getRegisteredMediums } from '@/game-data/medium/registry';
import { MEDIUM_RESOLUTION_ORDER, MEDIUM_RULES } from '@/game-data/medium/rules';
import {
  DEFAULT_RULE_BY_PHYSICS,
  PARTICLE_TYPE_OVERRIDES,
} from '@/game-data/particles/registry';
import {
  validateParticleTypes,
  type ParticleTypeValidationResult,
} from '@/game-data/particles/validate';
import type { ParticleType } from '@/types/particle';

/** Export `RegistryBootstrapState` — registry bootstrap state. */
export interface RegistryBootstrapState {
  mediumCount: number;
  particleOverrideCount: number;
  physicsFallbackFamilies: number;
  lastValidation: ParticleTypeValidationResult | null;
}

let bootstrapState: RegistryBootstrapState | null = null;

/** Export `initializeRegistries` — initialize registries. */
export function initializeRegistries(): RegistryBootstrapState {
  if (bootstrapState) {
    return bootstrapState;
  }

  bootstrapState = {
    mediumCount: getRegisteredMediums().length,
    particleOverrideCount: Object.keys(PARTICLE_TYPE_OVERRIDES).length,
    physicsFallbackFamilies: Object.keys(DEFAULT_RULE_BY_PHYSICS).length,
    lastValidation: null,
  };

  const actionValidation = validateActionRegistry();
  const conditionValidation = validateConditionRegistry();

  if (import.meta.env.DEV) {
    console.info('[registries] Medios:', getRegisteredMediums().join(', '));
    console.info('[registries] Orden resolución:', MEDIUM_RESOLUTION_ORDER.join(' → '));
    console.info('[registries] Umbrales:', MEDIUM_RULES);
    console.info('[registries] Acciones:', actionValidation.ok ? 'OK' : actionValidation.errors);
    console.info(
      '[registries] Condiciones:',
      conditionValidation.ok ? 'OK' : conditionValidation.errors,
    );
  }

  return bootstrapState;
}

/** Export `validateAndStoreParticleTypes` — validate and store particle types. */
export function validateAndStoreParticleTypes(
  types: ParticleType[],
  strict = false,
): ParticleTypeValidationResult {
  initializeRegistries();
  const result = validateParticleTypes(types, { strict });
  if (bootstrapState) {
    bootstrapState.lastValidation = result;
  }
  return result;
}

/** Export `getRegistryBootstrapState` — get registry bootstrap state. */
export function getRegistryBootstrapState(): RegistryBootstrapState | null {
  return bootstrapState;
}
