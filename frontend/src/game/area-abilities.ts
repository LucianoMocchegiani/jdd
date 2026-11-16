import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';
import { isCameraInspectMode } from '@/game/camera/camera-access';
import { isTextInputFocused } from '@/game/input/keyboard-state';
import type { ActionDefinition } from '@/types/action';
import type { AreaSpellEvent, CellPosition } from '@/types/world-events';
import {
  CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster,
  RingGeometry, Scene, SphereGeometry, Vector2, Vector3, type Camera,
} from 'three';
import type { TerrainStore } from '@/game/terrain/terrain-store';

const TARGET_REQUEST_EVENT = 'area-ability-target';
type CastAreaSpell = (action: ActionDefinition, target: CellPosition) => void;

export class AreaSpellVisuals {
  private readonly effects: Array<{ group: Group; ring: Mesh; core: Mesh; elapsed: number; duration: number }> = [];
  private targeting: AreaAbilityTargeting | null = null;

  constructor(private readonly scene: Scene, private readonly cellSize: number) {}

  enableTargeting(camera: Camera, canvas: HTMLCanvasElement, terrain: TerrainStore, cast: CastAreaSpell): void {
    this.targeting = new AreaAbilityTargeting(this.scene, camera, canvas, terrain, this.cellSize, cast);
  }

  apply(event: AreaSpellEvent): void {
    const group = new Group();
    const color = event.effect === 'thunder' ? 0xa78bfa : 0x55ddff;
    const ring = new Mesh(
      new RingGeometry(0.08, 1, 40),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(event.x * this.cellSize, event.z * this.cellSize + 0.04 * this.cellSize, event.y * this.cellSize);
    const core = event.effect === 'thunder'
      ? new Mesh(new CylinderGeometry(0.12 * this.cellSize, 0.28 * this.cellSize, 1, 8), new MeshBasicMaterial({ color: 0xe9d5ff, transparent: true, opacity: 0.95, depthWrite: false }))
      : new Mesh(new SphereGeometry(1, 12, 8), new MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }));
    const groundY = event.z * this.cellSize;
    core.position.set(event.x * this.cellSize, groundY + (event.effect === 'thunder' ? 6 : 1.4) * this.cellSize, event.y * this.cellSize);
    if (event.effect === 'thunder') core.scale.y = 12 * this.cellSize;
    else core.scale.setScalar(0.45 * this.cellSize);
    group.userData = { effect: event.effect, radius: event.radius, groundY };
    group.add(ring, core);
    this.scene.add(group);
    this.effects.push({ group, ring, core, elapsed: 0, duration: event.effect === 'thunder' ? 0.45 : 0.6 });
  }

  update(deltaTime: number, playerPosition?: CellPosition): void {
    if (playerPosition) this.targeting?.update(playerPosition);
    for (let i = this.effects.length - 1; i >= 0; i -= 1) {
      const effect = this.effects[i]!;
      effect.elapsed += deltaTime;
      const progress = Math.min(1, effect.elapsed / effect.duration);
      const radius = Number(effect.group.userData.radius);
      effect.ring.scale.setScalar((0.1 + 0.9 * progress) * radius * this.cellSize);
      (effect.ring.material as MeshBasicMaterial).opacity = 0.9 * (1 - progress);
      (effect.core.material as MeshBasicMaterial).opacity = 0.95 * (1 - progress);
      if (effect.group.userData.effect === 'orb') {
        effect.core.position.y = Number(effect.group.userData.groundY) + 1.4 * (1 - progress) * this.cellSize;
        effect.core.scale.setScalar((0.25 + 0.55 * progress) * this.cellSize);
      } else {
        effect.core.position.y = Number(effect.group.userData.groundY) + 6 * (1 - progress) * this.cellSize;
        effect.core.scale.y = Math.max(0.01, 12 * (1 - progress)) * this.cellSize;
      }
      if (effect.elapsed >= effect.duration) {
        this.scene.remove(effect.group);
        effect.group.traverse((object) => {
          if (!(object instanceof Mesh)) return;
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        });
        this.effects.splice(i, 1);
      }
    }
  }
}

class AreaAbilityTargeting {
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly rayPoint = new Vector3();
  private readonly marker = new Mesh(
    new RingGeometry(0.82, 1, 40),
    new MeshBasicMaterial({ color: 0x55ddff, transparent: true, opacity: 0.85, side: DoubleSide, depthWrite: false }),
  );
  private action: ActionDefinition | null = null;
  private target: CellPosition | null = null;
  private pointerX = 0;
  private pointerY = 0;

  constructor(
    private readonly scene: Scene,
    private readonly camera: Camera,
    private readonly canvas: HTMLCanvasElement,
    private readonly terrain: TerrainStore,
    private readonly cellSize: number,
    private readonly cast: CastAreaSpell,
  ) {
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.marker.renderOrder = 5;
    scene.add(this.marker);
    document.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener(TARGET_REQUEST_EVENT, this.onTargetRequest);
    window.addEventListener('blur', this.cancel);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('click', this.onClick, true);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  update(player: CellPosition): void {
    if (!this.action?.area || isCameraInspectMode()) {
      this.cancel();
      return;
    }
    this.marker.visible = false;
    this.target = null;
    const rect = this.canvas.getBoundingClientRect();
    if (document.pointerLockElement === this.canvas) this.pointer.set(0, 0);
    else this.pointer.set((this.pointerX / rect.width) * 2 - 1, -(this.pointerY / rect.height) * 2 + 1);
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const ray = this.raycaster.ray;
    if (ray.direction.y >= 0) return;

    const playerPosition = new Vector3(player.x * this.cellSize, player.z * this.cellSize, player.y * this.cellSize);
    const maxDistance = this.camera.position.distanceTo(playerPosition) + this.action.area.range * this.cellSize;
    const step = this.cellSize * 0.1;
    for (let distance = 0; distance <= maxDistance; distance += step) {
      ray.at(distance, this.rayPoint);
      const cellX = Math.floor(this.rayPoint.x / this.cellSize + 0.5);
      const cellY = Math.floor(this.rayPoint.z / this.cellSize + 0.5);
      const cellZ = Math.floor(this.rayPoint.y / this.cellSize);
      if (!this.terrain.isCellSolid(cellX, cellY, cellZ)) continue;
      const surfaceY = (cellZ + 0.46) * this.cellSize;
      const surfaceDistance = (surfaceY - ray.origin.y) / ray.direction.y;
      if (surfaceDistance < distance - step || surfaceDistance > distance) return;
      const worldX = ray.origin.x + ray.direction.x * surfaceDistance;
      const worldZ = ray.origin.z + ray.direction.z * surfaceDistance;
      if (Math.abs(worldX / this.cellSize - cellX) > 0.46 || Math.abs(worldZ / this.cellSize - cellY) > 0.46) return;
      const target = { x: worldX / this.cellSize, y: worldZ / this.cellSize, z: surfaceY / this.cellSize };
      if (Math.hypot(target.x - player.x, target.y - player.y, target.z - player.z) > this.action.area.range) return;
      this.target = target;
      this.marker.position.set(worldX, surfaceY + 0.025 * this.cellSize, worldZ);
      this.marker.scale.setScalar(this.action.area.radius * this.cellSize);
      (this.marker.material as MeshBasicMaterial).color.set(this.action.area.effect === 'thunder' ? 0xa78bfa : 0x55ddff);
      this.marker.visible = true;
      return;
    }
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = event.clientX - rect.left;
    this.pointerY = event.clientY - rect.top;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isTextInputFocused()) return;
    if (this.action && event.code === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancel();
      return;
    }
    if (event.repeat) return;
    const action = BODY_ACTIONS.find((candidate) => candidate.area && INTENT_KEY_CODES[candidate.control.inputIntent]?.includes(event.code));
    if (!action || isCameraInspectMode()) return;
    event.preventDefault();
    this.activate(action);
  };

  private readonly onTargetRequest = (event: Event): void => {
    const id = (event as CustomEvent<{ actionId?: string }>).detail?.actionId;
    const action = BODY_ACTIONS.find((candidate) => candidate.id === id && candidate.area);
    if (action && !isCameraInspectMode()) this.activate(action);
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (!this.action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.button === 0 && this.target) {
      this.cast(this.action, this.target);
      this.cancel();
    } else if (event.button === 2) this.cancel();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (!this.action) return;
    event.preventDefault();
    this.cancel();
  };

  private activate(action: ActionDefinition): void {
    if (this.action?.id === action.id) {
      this.cancel();
      return;
    }
    this.action = action;
    this.target = null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = rect.width / 2;
    this.pointerY = rect.height / 2;
  }

  private readonly cancel = (): void => {
    this.action = null;
    this.target = null;
    this.marker.visible = false;
  };
}
