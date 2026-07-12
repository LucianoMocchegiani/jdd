/**
 * @file Cámara del jugador local: órbita 3ª persona, modo inspect y acoplamiento a {@link FacingComponent} (fase 7).
 *
 * Vive **fuera del ECS** (una instancia por sesión). {@link bootstrapApp} crea el controlador,
 * lo registra con {@link setCameraController} y lo invoca cada frame:
 *
 * ```text
 * tickInput(world)     → ratón, toggle C, facing.yaw (si third_person)
 * world.update()       → movimiento lee facing + pitch vía camera-access
 * updateCamera(...)    → posición Three.js + rotación mesh
 * renderer.render()
 * ```
 *
 * Entrada de ratón: {@link CameraInputBinding}. Locomoción relativa: {@link movement-relative}.
 * Spec: `Ideas/habilidades/frontend-v2-camara.md`.
 */

import {
  CAMERA_DEFAULT_PITCH,
  CAMERA_DISTANCE_DEFAULT_CELLS,
  CAMERA_DISTANCE_MAX_CELLS,
  CAMERA_DISTANCE_MIN_CELLS,
  CAMERA_INSPECT_TOGGLE_KEY,
  CAMERA_LOOK_HEIGHT_CELLS,
  CAMERA_MOUSE_SENSITIVITY,
  CAMERA_PITCH_MAX,
  CAMERA_PITCH_MIN,
  CAMERA_POSITION_SMOOTHING,
  CAMERA_ZOOM_SPEED_CELLS,
} from '@/game-data/game-config';
import { FacingComponent } from '@/ecs/components/facing';
import type { World } from '@/ecs/core';
import { CameraInputBinding } from '@/game/camera/camera-input';
import { meshRotationYFromYaw } from '@/game/camera/movement-relative';
import {
  type CameraMode,
  couplesFacingToCamera,
} from '@/game/camera/camera-types';
import { isKeyHeld } from '@/game/input/keyboard-state';
import type { Group, PerspectiveCamera } from 'three';
import { Vector3 } from 'three';

/**
 * Control de vista del jugador local.
 *
 * **Modos (`CameraMode`)**
 * - `third_person` — ratón gira cámara **y** personaje (`couplesFacingToCamera`); WASD vía {@link FacingComponent}.
 * - `inspect` — ratón solo orbita; `facing.yaw` congelado; {@link InputSystem} bloquea movimiento/ataque.
 * - `first_person` — reservado; {@link updateCamera} sale sin posicionar (stub).
 *
 * **Estado público** expuesto a {@link getCameraController} (`mode`, `pitch`) para movimiento 3D en agua/aire.
 */
export class CameraController {
  /** Modo activo; por defecto `third_person` al spawn. */
  mode: CameraMode = 'third_person';

  /**
   * Yaw de la órbita (rad), convención {@link movement-relative} (adelante en yaw 0 = −Y celda).
   * En `inspect` puede divergir de `facing.yaw` mientras orbitas.
   */
  yaw = 0;

  /**
   * Pitch de la órbita (rad); inicial {@link CAMERA_DEFAULT_PITCH}.
   * Clampeado entre {@link CAMERA_PITCH_MIN} y {@link CAMERA_PITCH_MAX} cada frame con ratón.
   */
  pitch = CAMERA_DEFAULT_PITCH;

  /** Distancia cámara–jugador en **celdas** (scroll ajusta con límites en `game-config`). */
  distanceCells = CAMERA_DISTANCE_DEFAULT_CELLS;

  private readonly input: CameraInputBinding;
  /** Evita rebotes del toggle {@link CAMERA_INSPECT_TOGGLE_KEY} (`KeyC`). */
  private inspectToggleWasHeld = false;
  /** Punto de mira Three.js (pecho del jugador). */
  private readonly targetPos = new Vector3();
  /** Posición deseada de la cámara antes del `lerp`. */
  private readonly desiredCamPos = new Vector3();

  /**
   * @param _camera - Reservado para `first_person` (posición en ojos); hoy no se usa en 3ª persona.
   * @param canvas - `renderer.domElement` para pointer lock y listeners.
   * @param playerMesh - Grupo del jugador; se actualiza `rotation.y` en {@link updateCamera}.
   */
  constructor(
    _camera: PerspectiveCamera,
    canvas: HTMLCanvasElement,
    private readonly playerMesh: Group,
  ) {
    this.input = new CameraInputBinding(canvas, (direction, _ev) => {
      this.distanceCells += direction * CAMERA_ZOOM_SPEED_CELLS;
      this.distanceCells = Math.max(
        CAMERA_DISTANCE_MIN_CELLS,
        Math.min(CAMERA_DISTANCE_MAX_CELLS, this.distanceCells),
      );
    });
  }

  /**
   * Libera listeners de ratón y sale de pointer lock si estaba activo.
   * Llamar al cerrar la sesión de juego.
   */
  dispose(): void {
    this.input.dispose();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  /**
   * Fase de **entrada** de cámara: debe ejecutarse **antes** de `world.update`.
   *
   * - Toggle **C** entre `third_person` ↔ `inspect` (flanco de tecla).
   * - {@link CameraInputBinding.drain} → actualiza `yaw` / `pitch` (solo movimiento del ratón con lock).
   * - Si {@link couplesFacingToCamera}: copia `yaw` a {@link FacingComponent}.
   *
   * @param world - Mundo ECS (escribe `facing` del jugador).
   * @param playerEntityId - Entidad poseída por el jugador local.
   */
  tickInput(world: World, playerEntityId: number): void {
    this.handleInspectToggle(world, playerEntityId);

    const { movementX, movementY } = this.input.drain();
    if (movementX !== 0 || movementY !== 0) {
      this.yaw -= movementX * CAMERA_MOUSE_SENSITIVITY;
      this.pitch += movementY * CAMERA_MOUSE_SENSITIVITY;
      this.pitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, this.pitch));
    }

    if (couplesFacingToCamera(this.mode)) {
      const facing = world.getComponent<FacingComponent>(playerEntityId, 'facing');
      if (facing) {
        facing.yaw = this.yaw;
      }
      this.playerMesh.rotation.y = meshRotationYFromYaw(this.yaw);
    }
  }

  /**
   * Fase de **presentación**: posiciona la cámara Three.js tras {@link MovementSystem}.
   *
   * Mapeo ECS → Three (igual que {@link syncPlayerMesh}):
   * - celda `x` → `X`, celda `y` → `Z`, celda `z` (altura) → `Y`.
   *
   * Órbita esférica: `distanceCells` + `yaw` + `pitch`; `lookAt` al pecho
   * (`CAMERA_LOOK_HEIGHT_CELLS`). Posición con {@link CAMERA_POSITION_SMOOTHING} (`lerp`).
   *
   * Rotación del mesh: {@link meshRotationYFromYaw} en `third_person`; en `inspect`, yaw congelado en `facing`.
   *
   * @param camera - `PerspectiveCamera` de la escena.
   * @param world - Para leer `facing` en modo inspect.
   * @param playerEntityId - Jugador local.
   * @param cellX - `PositionComponent.x`
   * @param cellY - `PositionComponent.y`
   * @param cellZ - `PositionComponent.z` (altura)
   * @param cellSize - `bloque.tamano_celda` / escala del mundo.
   */
  updateCamera(
    camera: PerspectiveCamera,
    world: World,
    playerEntityId: number,
    cellX: number,
    cellY: number,
    cellZ: number,
    cellSize: number,
  ): void {
    const targetX = cellX * cellSize;
    const targetY = cellZ * cellSize;
    const targetZ = cellY * cellSize;
    const lookY = targetY + CAMERA_LOOK_HEIGHT_CELLS * cellSize;

    this.targetPos.set(targetX, lookY, targetZ);

    if (this.mode === 'first_person') {
      return;
    }

    const horizontalDistance = this.distanceCells * cellSize * Math.cos(this.pitch);
    const verticalDistance = this.distanceCells * cellSize * Math.sin(this.pitch);

    const camX = targetX + horizontalDistance * Math.sin(this.yaw);
    const camY = targetY + verticalDistance;
    const camZ = targetZ + horizontalDistance * Math.cos(this.yaw);

    this.desiredCamPos.set(camX, camY, camZ);
    camera.position.lerp(this.desiredCamPos, CAMERA_POSITION_SMOOTHING);
    camera.lookAt(this.targetPos);

    const facing = world.getComponent<FacingComponent>(playerEntityId, 'facing');
    const meshYaw = couplesFacingToCamera(this.mode) ? this.yaw : (facing?.yaw ?? this.yaw);
    this.playerMesh.rotation.y = meshRotationYFromYaw(meshYaw);
  }

  /**
   * Cambia el modo de cámara y sincroniza yaw al entrar/salir de `inspect`.
   *
   * - Entrada a `third_person` (desde `inspect`): `yaw` ← `facing.yaw` (vista alineada al cuerpo quieto).
   * - Entrada a `third_person` genérica: opcionalmente alinea yaw desde facing si se pasan `world` + id.
   *
   * @param mode - Nuevo modo.
   * @param world - Requerido para restaurar yaw al salir de inspect.
   * @param playerEntityId - Entidad jugador.
   */
  setMode(mode: CameraMode, world?: World, playerEntityId?: number): void {
    if (mode === this.mode) {
      return;
    }

    if (mode === 'third_person' && world != null && playerEntityId != null) {
      const facing = world.getComponent<FacingComponent>(playerEntityId, 'facing');
      if (facing) {
        this.yaw = facing.yaw;
      }
    }

    if (this.mode === 'inspect' && mode === 'third_person') {
      const facing = world?.getComponent<FacingComponent>(playerEntityId ?? -1, 'facing');
      if (facing) {
        this.yaw = facing.yaw;
      }
    }

    this.mode = mode;
  }

  /**
   * Toggle {@link CAMERA_INSPECT_TOGGLE_KEY} en flanco ascendente (una pulsación = un cambio).
   */
  private handleInspectToggle(world: World, playerEntityId: number): void {
    const held = isKeyHeld(CAMERA_INSPECT_TOGGLE_KEY);
    if (held && !this.inspectToggleWasHeld) {
      if (this.mode === 'inspect') {
        this.setMode('third_person', world, playerEntityId);
      } else if (this.mode === 'third_person') {
        this.setMode('inspect', world, playerEntityId);
      }
    }
    this.inspectToggleWasHeld = held;
  }
}
