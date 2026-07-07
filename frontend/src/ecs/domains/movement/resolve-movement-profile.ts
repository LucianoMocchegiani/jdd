/**
 * @file Une el medio de locomoción (ECS) con el tuning estático y la viscosidad del terreno.
 *
 * {@link ParticleContextSystem} escribe {@link ContactComponent.medium} y
 * `dominantTipoNombre` cada frame; {@link MovementSystem} llama aquí para obtener
 * números listos para integrar (velocidad, gravedad, flotación, drag).
 *
 * La lógica numérica vive en `game-data/movement/profiles.ts`; este módulo solo
 * resuelve el contexto de la entidad y devuelve un snapshot inmutable por frame.
 */

import {
  MEDIUM_MOVEMENT_PROFILES,
  baseMoveSpeedCells,
  effectiveGravityZ,
  type MediumMovementProfile,
} from '@/game-data/movement';
import type { Medium } from '@/types/medium';
import type { ParticleType } from '@/types/particle';

/**
 * Parámetros de locomoción ya combinados para un frame concreto.
 *
 * Se pasa a {@link computeMovementFromAction} (velocidad horizontal e impulso)
 * y al bloque de física vertical de {@link MovementSystem} cuando no hay suelo.
 */
export interface ResolvedMovementProfile {
  /** Medio exclusivo del frame (`ground`, `air`, `submerged_*`). */
  medium: Medium;
  /** Nombre del tipo de partícula dominante en el radio de contacto, o `null`. */
  dominantTipoNombre: string | null;
  /**
   * Viscosidad del tipo dominante (API/BD), o `null` si no hay tipo o no trae campo.
   * Afecta solo `moveSpeedCells` vía {@link baseMoveSpeedCells}.
   */
  viscosidad: number | null;
  /** Perfil crudo de `MEDIUM_MOVEMENT_PROFILES[medium]` (multiplicadores base). */
  mediumProfile: MediumMovementProfile;
  /**
   * Velocidad horizontal en celdas/s: `PLAYER_MOVE_SPEED_CELLS × perfil.medio × viscosidad`.
   * Las fichas `constant_displacements` aplican `speedMultiplier` encima en `apply-movement-from-action`.
   */
  moveSpeedCells: number;
  /** Caída en Z (celdas/s²) cuando `medium !== 'ground'`. */
  gravityZ: number;
  /** Empuje ascendente en fluido sumergido (celdas/s²). */
  buoyancyZ: number;
  /** Amortiguación de `vz` en fluido (factor por segundo). */
  verticalDrag: number;
}

/**
 * Calcula el perfil efectivo de movimiento para una entidad este frame.
 *
 * @param medium - Medio de locomoción desde {@link ContactComponent} (contacto/partículas).
 * @param dominantTipoNombre - Material dominante en el radio; usado para buscar `viscosidad`.
 * @param typesByNombre - Catálogo del viewport (`TerrainStore.getTypesByNombre()`).
 * @returns Snapshot con velocidad, gravedad y coeficientes de fluido ya escalados.
 *
 * @remarks
 * - **Velocidad:** {@link baseMoveSpeedCells} combina `MEDIUM_MOVEMENT_PROFILES` y viscosidad.
 * - **Gravedad:** {@link effectiveGravityZ} solo depende del `medium` (no de la viscosidad).
 * - **Flotación / drag:** se copian del perfil del medio (`buoyancy`, `verticalDrag`).
 * - Función pura: sin efectos secundarios; seguro llamarla cada frame por entidad.
 */
export function resolveMovementProfile(
  medium: Medium,
  dominantTipoNombre: string | null,
  typesByNombre: ReadonlyMap<string, ParticleType>,
): ResolvedMovementProfile {
  const tipo = dominantTipoNombre ? typesByNombre.get(dominantTipoNombre) : undefined;
  const viscosidad = tipo?.viscosidad ?? null;
  const mediumProfile = MEDIUM_MOVEMENT_PROFILES[medium];

  return {
    medium,
    dominantTipoNombre,
    viscosidad,
    mediumProfile,
    moveSpeedCells: baseMoveSpeedCells(medium, viscosidad),
    gravityZ: effectiveGravityZ(medium),
    buoyancyZ: mediumProfile.buoyancy,
    verticalDrag: mediumProfile.verticalDrag,
  };
}
