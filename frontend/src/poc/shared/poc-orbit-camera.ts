/**
 * Cámara orbital mínima para POCs (pointer lock + zoom).
 */

import {
  CAMERA_DEFAULT_PITCH,
  CAMERA_DISTANCE_DEFAULT_CELLS,
  CAMERA_DISTANCE_MAX_CELLS,
  CAMERA_DISTANCE_MIN_CELLS,
  CAMERA_MOUSE_SENSITIVITY,
  CAMERA_PITCH_MAX,
  CAMERA_PITCH_MIN,
  CAMERA_POSITION_SMOOTHING,
  CAMERA_ZOOM_SPEED_CELLS,
} from '@/game-data/game-config';
import { CameraInputBinding } from '@/game/camera/camera-input';
import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';

/** Altura de mira (pecho/cabeza) para personaje ~3 celdas. */
export const POC_LOOK_HEIGHT_CELLS = 2.6;

export type PocOrbitWheelHandler = (
  direction: number,
  ev: WheelEvent,
  orbit: PocOrbitCamera,
) => void;

export class PocOrbitCamera {
  yaw = Math.PI * 0.25;
  pitch = CAMERA_DEFAULT_PITCH;
  distanceCells = CAMERA_DISTANCE_DEFAULT_CELLS;

  /** Desplazamiento del punto de órbita respecto al torso del personaje (metros). */
  readonly pivotOffset = new Vector3(0, 0, 0);

  private readonly input: CameraInputBinding;
  private readonly targetPos = new Vector3();
  private readonly desiredCamPos = new Vector3();
  private readonly torsoTarget = new Vector3();

  constructor(
    canvas: HTMLCanvasElement,
    onWheel?: PocOrbitWheelHandler,
  ) {
    this.input = new CameraInputBinding(canvas, (dir, ev) => {
      if (onWheel) onWheel(dir, ev, this);
      else this.applyDefaultZoom(dir);
    });
  }

  /** Ajusta distancia con límites del juego. */
  applyDefaultZoom(direction: number): void {
    this.distanceCells = Math.min(
      CAMERA_DISTANCE_MAX_CELLS,
      Math.max(CAMERA_DISTANCE_MIN_CELLS, this.distanceCells + direction * CAMERA_ZOOM_SPEED_CELLS),
    );
  }

  /** Punto de mira por defecto (torso) sin `pivotOffset`. */
  getTorsoTarget(cellX: number, cellY: number, cellZ: number, cellSize: number, out = this.torsoTarget): Vector3 {
    out.set(
      cellX * cellSize,
      cellZ * cellSize + POC_LOOK_HEIGHT_CELLS * cellSize,
      cellY * cellSize,
    );
    return out;
  }

  tickInput(): void {
    const frame = this.input.drain();
    this.yaw -= frame.movementX * CAMERA_MOUSE_SENSITIVITY;
    this.pitch += frame.movementY * CAMERA_MOUSE_SENSITIVITY;
    this.pitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, this.pitch));
  }

  updateCamera(
    camera: PerspectiveCamera,
    cellX: number,
    cellY: number,
    cellZ: number,
    cellSize: number,
  ): void {
    this.getTorsoTarget(cellX, cellY, cellZ, cellSize, this.targetPos);
    this.targetPos.add(this.pivotOffset);

    const horizontalDistance = this.distanceCells * cellSize * Math.cos(this.pitch);
    const verticalDistance = this.distanceCells * cellSize * Math.sin(this.pitch);

    const camX = this.targetPos.x + horizontalDistance * Math.sin(this.yaw);
    const camY = this.targetPos.y + verticalDistance;
    const camZ = this.targetPos.z + horizontalDistance * Math.cos(this.yaw);

    this.desiredCamPos.set(camX, camY, camZ);
    camera.position.lerp(this.desiredCamPos, CAMERA_POSITION_SMOOTHING);
    camera.lookAt(this.targetPos);
  }

  dispose(): void {
    this.input.dispose();
  }
}
