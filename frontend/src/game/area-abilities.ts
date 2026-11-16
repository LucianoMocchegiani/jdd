import { BODY_ACTIONS } from '@/game-data/actions';
import { INTENT_KEY_CODES } from '@/ecs/domains/input/input-system';
import type { ActionDefinition } from '@/types/action';
import type { AreaSpellEvent, CellPosition } from '@/types/world-events';
import { isCameraInspectMode } from '@/game/camera/camera-access';
import { isTextInputFocused } from '@/game/input/keyboard-state';
import {
  CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Raycaster,
  RingGeometry, Scene, SphereGeometry, Vector2, Vector3, type Camera,
} from 'three';
import type { TerrainStore } from '@/game/terrain/terrain-store';
import { isAreaTargetWithinRange } from './area-target-range';

const TARGET_EVENT = 'area-ability-target';
type Cast = (action: ActionDefinition, target: CellPosition) => void;

export class AreaAbilityTargeting {
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
    private readonly cast: Cast,
  ) {
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    this.marker.renderOrder = 5;
    scene.add(this.marker);
    document.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener(TARGET_EVENT, this.onTargetRequest);
    document.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerdown', this.onPointerDown, true);
    canvas.addEventListener('click', this.onClick, true);
  }

  dispose(): void {
    document.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener(TARGET_EVENT, this.onTargetRequest);
    document.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown, true);
    this.canvas.removeEventListener('click', this.onClick, true);
    this.marker.removeFromParent();
    this.marker.geometry.dispose();
    (this.marker.material as MeshBasicMaterial).dispose();
  }

  update(playerX: number, playerY: number, playerZ: number): void {
    const action = this.action;
    if (!action?.area) return;
    this.marker.visible = false;
    this.target = null;
    const rect = this.canvas.getBoundingClientRect();
    if (document.pointerLockElement === this.canvas) this.pointer.set(0, 0);
    else this.pointer.set((this.pointerX / rect.width) * 2 - 1, -(this.pointerY / rect.height) * 2 + 1);
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const ray = this.raycaster.ray;
    if (ray.direction.y >= 0) return;
    const playerPosition = new Vector3(playerX * this.cellSize, playerZ * this.cellSize, playerY * this.cellSize);
    const maxDistance = this.camera.position.distanceTo(playerPosition) + action.area.range * this.cellSize;
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
      if (!isAreaTargetWithinRange(target, { x: playerX, y: playerY, z: playerZ }, action.area.range)) return;
      this.target = target;
      this.marker.position.set(worldX, surfaceY + 0.025 * this.cellSize, worldZ);
      this.marker.scale.setScalar(action.area.radius * this.cellSize);
      (this.marker.material as MeshBasicMaterial).color.set(action.area.effect === 'thunder' ? 0xa78bfa : 0x55ddff);
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
    if (event.repeat || isCameraInspectMode()) return;
    const action = BODY_ACTIONS.find((candidate) => candidate.area && INTENT_KEY_CODES[candidate.control.inputIntent]?.includes(event.code));
    if (!action) return;
    event.preventDefault();
    this.activate(action);
  };

  private readonly onTargetRequest = (event: Event): void => {
    if (isCameraInspectMode()) return;
    const id = (event as CustomEvent<{ actionId?: string }>).detail?.actionId;
    const action = BODY_ACTIONS.find((candidate) => candidate.id === id && candidate.area);
    if (action) this.activate(action);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (this.action && event.button === 2) {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.cancel();
    }
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (!this.action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (this.target) this.cast(this.action, this.target);
    this.cancel();
  };

  private readonly onContextMenu = (event: Event): void => {
    if (this.action) {
      event.preventDefault();
      this.cancel();
    }
  };

  private activate(action: ActionDefinition): void {
    this.action = action;
    this.target = null;
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = rect.width / 2;
    this.pointerY = rect.height / 2;
  }

  private cancel(): void {
    this.action = null;
    this.target = null;
    this.marker.visible = false;
  }
}

interface EffectView { group: Group; ring: Mesh; core: Mesh; elapsed: number; duration: number; }
export class AreaSpellVisuals {
  private readonly effects: EffectView[] = [];
  constructor(private readonly scene: Scene, private readonly cellSize: number) {}

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

  update(deltaTime: number): void {
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
