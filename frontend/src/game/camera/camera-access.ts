/**
 * @file Acceso global al controlador de cámara del jugador local.
 */

import type { CameraMode } from './camera-types';

/**
 * Superficie mínima para el resto del juego (sin importar {@link CameraController}).
 */
export interface CameraControllerRef {
  readonly mode: CameraMode;
  readonly pitch: number;
}

let controller: CameraControllerRef | null = null;

/** Export `setCameraController` — set camera controller. */
export function setCameraController(instance: CameraControllerRef | null): void {
  controller = instance;
}

/** Export `getCameraController` — get camera controller. */
export function getCameraController(): CameraControllerRef | null {
  return controller;
}

/** Export `getCameraMode` — get camera mode. */
export function getCameraMode(): CameraMode {
  return controller?.mode ?? 'third_person';
}

/** Export `isCameraInspectMode` — is camera inspect mode. */
export function isCameraInspectMode(): boolean {
  return getCameraMode() === 'inspect';
}
