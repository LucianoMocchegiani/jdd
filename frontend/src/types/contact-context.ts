/**
 * @file Resultado del muestreo de contacto (fase 3: `ParticleContextSystem`).
 */

import type { Medium } from '@/types/medium';
import type { ParticleType } from '@/types/particle';

/**
 * Contexto de contacto con el mundo por frame.
 *
 * - {@link medium} — un solo valor: geometría / inmersión.
 * - {@link dominantTipoNombre} — sustancia dominante en el radio (`agua`, `lodo`, `arena_movediza`, …).
 *   La movilidad (viscosidad, coste) lee {@link ParticleType} del API, no otro `medium`.
 */
export interface ContactContext {
  medium: Medium;
  /** `tipo_nombre` más relevante en el radio; `null` en `air` / solo sólido sin fluido. */
  dominantTipoNombre: string | null;
  /** Id del tipo dominante si se resolvió contra el catálogo del viewport. */
  dominantTipoParticulaId: string | null;
}
