/**
 * @file Validación de tipos de partícula del API contra el registry local.
 */

import { hasExplicitOverride, resolveContactRule } from '@/game-data/particles/registry';
import type { ParticleType } from '@/types/particle';

/** Export `ParticleTypeValidationResult` — particle type validation result. */
export interface ParticleTypeValidationResult {
  ok: boolean;
  usingPhysicsFallback: string[];
  unmapped: string[];
  checked: number;
}

/** Export `ValidateParticleTypesOptions` — validate particle types options. */
export interface ValidateParticleTypesOptions {
  strict?: boolean;
}

/** Export `validateParticleTypes` — validate particle types. */
export function validateParticleTypes(
  types: ParticleType[],
  options: ValidateParticleTypesOptions = {},
): ParticleTypeValidationResult {
  const usingPhysicsFallback: string[] = [];
  const unmapped: string[] = [];

  for (const type of types) {
    if (hasExplicitOverride(type.nombre)) {
      resolveContactRule(type);
      continue;
    }

    if (type.tipo_fisico) {
      usingPhysicsFallback.push(type.nombre);
      resolveContactRule(type);
      continue;
    }

    unmapped.push(type.nombre);
  }

  const result: ParticleTypeValidationResult = {
    ok: unmapped.length === 0,
    usingPhysicsFallback,
    unmapped,
    checked: types.length,
  };

  if (unmapped.length > 0) {
    const message =
      `[particle-registry] Tipos sin mapeo ni tipo_fisico: ${unmapped.join(', ')}. ` +
      'Añade entrada en game-data/particles/registry.ts o corrige la BD.';
    if (options.strict) {
      throw new Error(message);
    }
    if (import.meta.env.DEV) {
      console.warn(message);
    }
  } else if (usingPhysicsFallback.length > 0 && import.meta.env.DEV) {
    console.info(
      '[particle-registry] Tipos usando fallback por tipo_fisico:',
      usingPhysicsFallback.join(', '),
    );
  }

  return result;
}
