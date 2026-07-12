/**
 * Cámara orbital del Character Studio: zoom al cursor y enfocar selección.
 *
 * @module character-studio/studio-orbit-camera
 */

import {
  CAMERA_DISTANCE_MAX_CELLS,
  CAMERA_DISTANCE_MIN_CELLS,
  CAMERA_ZOOM_SPEED_CELLS,
} from '@/game-data/game-config';
import { PocOrbitCamera } from '@/poc/shared/poc-orbit-camera';
import type { PerspectiveCamera } from 'three';
import { Plane, Quaternion, Raycaster, Vector2, Vector3 } from 'three';

const ZOOM_PIVOT_OUT = 0.12;

export class StudioOrbitCamera extends PocOrbitCamera {
  private readonly canvas: HTMLCanvasElement;
  private threeCamera: PerspectiveCamera | null = null;
  private lastCell = { x: 0, y: 0, z: 0, size: 1 };

  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly plane = new Plane();
  private readonly hit = new Vector3();
  private readonly torso = new Vector3();
  private readonly orbitTarget = new Vector3();
  private readonly orbitCamPos = new Vector3();
  private readonly pivotDelta = new Vector3();
  private readonly viewDir = new Vector3();
  private readonly savedCamPos = new Vector3();
  private readonly savedCamQuat = new Quaternion();
  private readonly zeroPivot = new Vector3(0, 0, 0);

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, (dir, ev, orbit) => {
      (orbit as StudioOrbitCamera).handleWheel(dir, ev);
    });
    this.canvas = canvas;
  }

  bindCamera(camera: PerspectiveCamera): void {
    this.threeCamera = camera;
  }

  override updateCamera(
    camera: PerspectiveCamera,
    cellX: number,
    cellY: number,
    cellZ: number,
    cellSize: number,
  ): void {
    this.lastCell = { x: cellX, y: cellY, z: cellZ, size: cellSize };
    super.updateCamera(camera, cellX, cellY, cellZ, cellSize);
  }

  /** Mueve el punto de órbita hacia una posición mundial (p. ej. pieza o hueso seleccionado). */
  focusWorldPoint(world: Vector3): void {
    const { x, y, z, size } = this.lastCell;
    this.getTorsoTarget(x, y, z, size, this.torso);
    this.pivotOffset.copy(world).sub(this.torso);
  }

  /** Vuelve el punto de órbita al torso del personaje. */
  resetFocus(): void {
    this.pivotOffset.set(0, 0, 0);
  }

  private handleWheel(direction: number, ev: WheelEvent): void {
    if (direction === 0) return;

    const oldDist = this.distanceCells;
    const newDist = Math.min(
      CAMERA_DISTANCE_MAX_CELLS,
      Math.max(CAMERA_DISTANCE_MIN_CELLS, oldDist + direction * CAMERA_ZOOM_SPEED_CELLS),
    );

    if (direction < 0 && newDist < oldDist) {
      this.dollyTargetTowardCursor(ev, oldDist, newDist);
    } else if (direction > 0) {
      this.pivotOffset.lerp(this.zeroPivot, ZOOM_PIVOT_OUT);
    }

    this.distanceCells = newDist;
  }

  /** Desplaza el target para que el punto bajo el cursor quede fijo al acercar (dolly). */
  private dollyTargetTowardCursor(ev: WheelEvent, oldDist: number, newDist: number): void {
    const camera = this.threeCamera;
    if (!camera) return;

    const moveFactor = 1 - newDist / oldDist;
    if (moveFactor <= 0) return;

    this.getOrbitState(this.orbitTarget, this.orbitCamPos);

    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    this.ndc.set(
      ((ev.clientX - rect.left) / rect.width) * 2 - 1,
      -((ev.clientY - rect.top) / rect.height) * 2 + 1,
    );

    this.savedCamPos.copy(camera.position);
    this.savedCamQuat.copy(camera.quaternion);
    camera.position.copy(this.orbitCamPos);
    camera.lookAt(this.orbitTarget);
    camera.updateMatrixWorld();

    this.raycaster.setFromCamera(this.ndc, camera);
    this.viewDir.copy(this.orbitTarget).sub(this.orbitCamPos).normalize();
    this.plane.setFromNormalAndCoplanarPoint(this.viewDir, this.orbitTarget);

    const hasHit = this.raycaster.ray.intersectPlane(this.plane, this.hit) !== null;

    camera.position.copy(this.savedCamPos);
    camera.quaternion.copy(this.savedCamQuat);

    if (!hasHit) return;

    this.pivotDelta.copy(this.hit).sub(this.orbitTarget);
    this.pivotOffset.addScaledVector(this.pivotDelta, moveFactor);
  }

  private getOrbitState(outTarget: Vector3, outCamPos: Vector3): void {
    const { x, y, z, size } = this.lastCell;
    this.getTorsoTarget(x, y, z, size, outTarget);
    outTarget.add(this.pivotOffset);

    const horizontalDistance = this.distanceCells * size * Math.cos(this.pitch);
    const verticalDistance = this.distanceCells * size * Math.sin(this.pitch);

    outCamPos.set(
      outTarget.x + horizontalDistance * Math.sin(this.yaw),
      outTarget.y + verticalDistance,
      outTarget.z + horizontalDistance * Math.cos(this.yaw),
    );
  }
}
