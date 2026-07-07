/**
 * @file Modos de cámara.
 */

export type CameraMode = 'third_person' | 'inspect' | 'first_person';

/** Export `couplesFacingToCamera` — couples facing to camera. */
export function couplesFacingToCamera(mode: CameraMode): boolean {
  return mode === 'third_person';
}
