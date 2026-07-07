/**
 * @file Línea de HUD para orientación de {@link CameraController}.
 */

import type { CameraMode } from '@/game/camera/camera-types';

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Texto de una línea: yaw/pitch en grados y modo activo.
 */
export function formatCameraHudLine(yaw: number, pitch: number, mode: CameraMode): string {
  const yawDeg = radToDeg(yaw);
  const pitchDeg = radToDeg(pitch);
  return `cámara: yaw ${yawDeg.toFixed(1)}° · pitch ${pitchDeg.toFixed(1)}° · ${mode}`;
}

/** Actualiza `#debug-camera` si el elemento existe. */
export function updateCameraHud(
  el: HTMLElement | null,
  yaw: number,
  pitch: number,
  mode: CameraMode,
): void {
  if (!el) {
    return;
  }
  el.textContent = formatCameraHudLine(yaw, pitch, mode);
}
