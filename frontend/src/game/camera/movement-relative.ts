/**
 * @file Traslación WASD en espacio de cámara (fase 7).
 *
 * Convierte flags de {@link InputComponent} + orientación de {@link CameraController}
 * en velocidad en **celdas/s** (`vx`, `vy`, `vz` del mundo ECS).
 *
 * Consumido por {@link computeMovementFromAction}; no integra posición ni colisión.
 * Convención de ejes: X/Y = planta; Z = altura (igual que {@link MovementSystem}).
 *
 * **Alineación con la órbita:** la cámara orbita en offset `(sin(yaw), cos(yaw))`; la vista
 * hacia el jugador es `cameraPlanarForwardUnit` = `(-sin, -cos)`. **W** usa esa vista en planta.
 *
 * @see `Juego de Dioses/Ideas/habilidades/frontend-v2-camara.md` §7.1 (suelo vs agua/aire)
 */

import { CAMERA_DEFAULT_PITCH } from '@/game-data/game-config';
import type { Medium } from '@/types/medium';

/**
 * Velocidad horizontal en celdas/s (plano X/Y).
 */
export interface PlanarVelocity {
  /** Componente X celda (derecha positiva). */
  vx: number;
  /** Componente Y celda. */
  vy: number;
}

/**
 * Velocidad en celdas/s incluyendo componente vertical continua (nadar/volar).
 */
export interface Velocity3D extends PlanarVelocity {
  /** Componente Z celda (arriba positiva). */
  vz: number;
}

/** Medios donde W sigue la mirada en 3D (yaw + pitch). */
export function usesCameraRelative3D(medium: Medium): boolean {
  return medium === 'air' || medium === 'submerged_partial' || medium === 'submerged_full';
}

/**
 * “Adelante” en planta: dirección de la vista de la cámara (hacia el jugador / horizonte).
 *
 * Coincide con el negativo del offset de órbita en {@link CameraController}.
 */
export function cameraPlanarForwardUnit(yaw: number): { x: number; y: number } {
  return {
    x: -Math.sin(yaw),
    y: -Math.cos(yaw),
  };
}

/** Strafe derecho (perpendicular a {@link cameraPlanarForwardUnit}). */
function cameraPlanarRightUnit(yaw: number): { x: number; y: number } {
  const f = cameraPlanarForwardUnit(yaw);
  return { x: -f.y, y: f.x };
}

/**
 * Velocidad en **planta** relativa a `yaw` (caminar/correr en suelo).
 */
export function computePlanarVelocityFromInput(
  forward: boolean,
  backward: boolean,
  left: boolean,
  right: boolean,
  speed: number,
  yaw: number,
): PlanarVelocity {
  const f = cameraPlanarForwardUnit(yaw);
  const r = cameraPlanarRightUnit(yaw);

  let fx = 0;
  let fy = 0;
  if (forward) {
    fx += f.x;
    fy += f.y;
  }
  if (backward) {
    fx -= f.x;
    fy -= f.y;
  }
  if (left) {
    fx -= r.x;
    fy -= r.y;
  }
  if (right) {
    fx += r.x;
    fy += r.y;
  }

  const len = Math.hypot(fx, fy);
  if (len < 1e-6) {
    return { vx: 0, vy: 0 };
  }
  return { vx: (fx / len) * speed, vy: (fy / len) * speed };
}

/**
 * Vector unitario de avance en 3D (agua/aire): yaw en planta + pitch **relativo** al default de 3ª persona.
 *
 * Con `pitch === CAMERA_DEFAULT_PITCH` no hay Z (W no sube por el ángulo de órbita fijo).
 * Inclinar la vista con el ratón (`pitch` ≠ default) añade subida/bajada (convención v1: `-sin`).
 */
export function cameraForwardUnit(yaw: number, pitch: number): { x: number; y: number; z: number } {
  const planar = cameraPlanarForwardUnit(yaw);
  const relativePitch = pitch - CAMERA_DEFAULT_PITCH;
  const cp = Math.cos(relativePitch);
  const sp = Math.sin(relativePitch);
  return {
    x: planar.x * cp,
    y: planar.y * cp,
    z: -sp,
  };
}

/**
 * Velocidad en agua/aire: W/S en {@link cameraForwardUnit}; A/D en planta (solo yaw).
 */
export function computeVelocity3DFromInput(
  forward: boolean,
  backward: boolean,
  left: boolean,
  right: boolean,
  speed: number,
  yaw: number,
  pitch: number,
): Velocity3D {
  let vx = 0;
  let vy = 0;
  let vz = 0;

  const f = cameraForwardUnit(yaw, pitch);
  if (forward) {
    vx += f.x * speed;
    vy += f.y * speed;
    vz += f.z * speed;
  }
  if (backward) {
    vx -= f.x * speed;
    vy -= f.y * speed;
    vz -= f.z * speed;
  }

  const planar = computePlanarVelocityFromInput(false, false, left, right, speed, yaw);
  vx += planar.vx;
  vy += planar.vy;

  return { vx, vy, vz };
}

/**
 * `rotation.y` del mesh Three.js (misma convención que v1 `render.rotationY = horizontal`).
 *
 * El cubo local mira a **−Z**; con este ángulo el frente sigue {@link cameraPlanarForwardUnit}
 * proyectado en el plano XZ (`celda x` → Three X, `celda y` → Three Z).
 */
export function meshRotationYFromYaw(yaw: number): number {
  return yaw;
}
