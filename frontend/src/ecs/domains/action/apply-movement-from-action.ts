/**
 * @file Traduce intents + fichas activas en velocidad para {@link MovementSystem} (fases 5–7).
 *
 * Punto de unión entre el **Action Registry** (slots `constant_displacements` /
 * `impulse_displacements`) y la cinemática. No integra posición ni aplica gravedad:
 * solo devuelve `vx`/`vy`/`vz` e `impulseZ` para que el sistema de movimiento los consuma.
 *
 * Desde fase 7, WASD es **relativo a la cámara** vía {@link FacingComponent.yaw} y
 * `pitch` del {@link CameraController} (ver {@link movement-relative}).
 */

import { InputComponent } from '@/ecs/components/input';
import {
  computePlanarVelocityFromInput,
  computeVelocity3DFromInput,
  usesCameraRelative3D,
} from '@/game/camera/movement-relative';
import type { ResolvedMovementProfile } from '@/ecs/domains/movement/resolve-movement-profile';
import type { ActionDefinition } from '@/types/action';

/**
 * Velocidades objetivo de un frame antes de gravedad, drag y colisión.
 *
 * Unidades: **celdas por segundo** en ejes del mundo ECS (X, Y = planta; Z = altura).
 */
export interface MovementFromActionResult {
  /** Velocidad horizontal X (celdas/s). */
  vx: number;
  /** Velocidad horizontal Y (celdas/s). */
  vy: number;
  /**
   * Velocidad Z continua cuando el medio usa control 3D (`air`, `submerged_*`).
   * En `ground` suele ser `0`; {@link MovementSystem} puede ignorarla si hay `impulseZ`.
   */
  vz: number;
  /**
   * Impulso instantáneo en Z desde ficha `impulse_displacements` (p. ej. salto).
   * Si no es `null`, {@link MovementSystem} asigna `kin.vz = impulseZ` con prioridad sobre `vz`.
   */
  impulseZ: number | null;
}

/**
 * Calcula la velocidad de locomoción del frame a partir de input, medio y fichas ganadoras.
 *
 * **Entradas**
 * - {@link InputComponent} — intents `move_*` (en `inspect` vienen en false por {@link InputSystem}).
 * - {@link ResolvedMovementProfile} — `moveSpeedCells` según `medium` + viscosidad.
 * - `constantDisplacements` — ficha del slot (walk, run, swim…); aporta `movement.speedMultiplier`.
 * - `impulseDisplacements` — ficha de impulso (jump…); aporta `movement.impulseZ` opcional.
 * - `yaw` — Orientación en planta ({@link FacingComponent}, acoplada a cámara en `third_person`).
 * - `pitch` — Inclinación de cámara (rad); solo afecta W/S en medios 3D.
 *
 * **Velocidad base**
 * `speed = profile.moveSpeedCells × (constantDisplacements?.movement?.speedMultiplier ?? 1)`
 *
 * **Rama por medio**
 * | Medio | Función | W/S |
 * |-------|---------|-----|
 * | `ground` | {@link computePlanarVelocityFromInput} | Planta según yaw |
 * | `air`, `submerged_*` | {@link computeVelocity3DFromInput} | Mirada 3D (yaw + pitch relativo al default) |
 *
 * **Salida y uso en {@link MovementSystem}**
 * - `kin.vx` / `kin.vy` ← siempre `vx` / `vy`.
 * - Si `impulseZ != null` → `kin.vz = impulseZ` (salto).
 * - Si no hay impulso y {@link usesCameraRelative3D} con W/S → `kin.vz = vz` (thrust).
 * - Si no, {@link MovementSystem} conserva `kin.vz` y aplica gravedad/flotación.
 *
 * @param input - Intents del frame (ya filtrados por modo cámara si aplica).
 * @param profile - Perfil resuelto de {@link resolveMovementProfile}.
 * @param constantDisplacements - Ficha activa en slot `constant_displacements` o `null`.
 * @param impulseDisplacements - Ficha activa en slot `impulse_displacements` o `null`.
 * @param yaw - Radianes; convención “adelante” en yaw 0 = −Y (ver {@link movement-relative}).
 * @param pitch - Radianes de cámara; ignorado en planta para W/S en `ground`.
 * @param conditionSpeedMultiplier - Producto de `effects.movement.speedMultiplier` de condiciones activas.
 * @returns Velocidades e impulso opcional; sin efectos secundarios (función pura).
 */
export function computeMovementFromAction(
  input: InputComponent,
  profile: ResolvedMovementProfile,
  constantDisplacements: ActionDefinition | null,
  impulseDisplacements: ActionDefinition | null,
  yaw: number,
  pitch: number,
  conditionSpeedMultiplier = 1,
): MovementFromActionResult {
  const speed =
    profile.moveSpeedCells *
    (constantDisplacements?.movement?.speedMultiplier ?? 1) *
    conditionSpeedMultiplier;

  const forward = input.isActive('move_forward');
  const backward = input.isActive('move_backward');
  const left = input.isActive('move_left');
  const right = input.isActive('move_right');

  let vx = 0;
  let vy = 0;
  let vz = 0;

  if (usesCameraRelative3D(profile.medium)) {
    const v3 = computeVelocity3DFromInput(
      forward,
      backward,
      left,
      right,
      speed,
      yaw,
      pitch,
    );
    vx = v3.vx;
    vy = v3.vy;
    vz = v3.vz;
  } else {
    const planar = computePlanarVelocityFromInput(
      forward,
      backward,
      left,
      right,
      speed,
      yaw,
    );
    vx = planar.vx;
    vy = planar.vy;
  }

  const impulseZ = impulseDisplacements?.movement?.impulseZ ?? null;

  return { vx, vy, vz, impulseZ };
}
