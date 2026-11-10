/**
 * Renderiza el jugador local con el rig y los clips del Character Studio.
 */

import { buildRig, SkeletonPose } from '@/poc/character-studio/rig-math';
import { createDefaultClipLibrary, sampleClip } from '@/poc/character-studio/studio-clip';
import { defaultBipedDocument } from '@/poc/character-studio/studio-document';
import { StudioRenderer } from '@/poc/character-studio/studio-renderer';
import type { StudioAnimationClip, StudioDocument } from '@/poc/character-studio/types';
import { DEFAULT_PALETTE } from '@/poc/shared';
import { PLAYER_GROUND_CLEARANCE_CELLS } from '@/game/player/find-spawn';
import { PARTICLE_SIZE_RATIO } from '@/game/terrain/particle-geometry';
import { Box3, MeshStandardMaterial, Vector3, type Scene } from 'three';

const PLAYER_GROUND_VISUAL_OFFSET_CELLS = PLAYER_GROUND_CLEARANCE_CELLS - PARTICLE_SIZE_RATIO / 2;
const UNIT_ELEMENT_BOUNDS = new Box3(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.5, 0.5, 0.5));

function rigOriginOffset(doc: StudioDocument, pose: SkeletonPose): Vector3 {
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const element of doc.elements) {
    const matrix = pose.elementWorldMatrix(element).clone().scale(new Vector3(...element.scale));
    const bounds = UNIT_ELEMENT_BOUNDS.clone().applyMatrix4(matrix);
    min.min(bounds.min);
    max.max(bounds.max);
  }
  if (!Number.isFinite(min.x)) throw new Error('El rig no tiene elementos renderizables');
  return new Vector3((min.x + max.x) / 2, min.y, (min.z + max.z) / 2).multiplyScalar(doc.gridStep);
}

export class PlayerCharacterVisual {
  private readonly doc = defaultBipedDocument();
  private readonly pose = new SkeletonPose(buildRig(this.doc), this.doc);
  private readonly rigOriginOffset = rigOriginOffset(this.doc, this.pose);
  private readonly renderer: StudioRenderer;
  private readonly clips = new Map<string, StudioAnimationClip>(
    createDefaultClipLibrary(this.doc.bones).clips.map((clip) => [clip.id, clip] as const),
  );
  private clipId = 'idle';
  private time = 0;
  private damageFlashUntilMs = 0;

  constructor(scene: Scene, cellSize: number) {
    this.renderer = new StudioRenderer(scene, cellSize);
  }

  update(
    deltaTime: number,
    requestedClip: string | null,
    x: number,
    y: number,
    z: number,
    yaw: number,
    tint: number | null,
  ): void {
    const current = this.clips.get(this.clipId)!;
    const requested = requestedClip === 'run' ? 'walk' : requestedClip;
    const requestedAnimation = requested ? this.clips.get(requested) : undefined;
    const keepOneShot =
      !current.loop && this.time < current.duration && (!requestedAnimation || requestedAnimation.loop);
    const nextId = keepOneShot ? this.clipId : requestedAnimation ? requested! : 'idle';

    if (nextId !== this.clipId) {
      this.clipId = nextId;
      this.time = 0;
    } else if (current.loop && current.duration > 0) {
      this.time = (this.time + deltaTime) % current.duration;
    } else {
      this.time = Math.min(this.time + deltaTime, current.duration);
    }

    const clip = this.clips.get(this.clipId)!;
    this.pose.setBoneRots(sampleClip(clip, this.time, this.doc.bones));
    const visualYaw = yaw + Math.PI / 2;
    const cosYaw = Math.cos(visualYaw);
    const sinYaw = Math.sin(visualYaw);
    this.renderer.sync(this.doc, this.pose, {
      x: x - cosYaw * this.rigOriginOffset.x - sinYaw * this.rigOriginOffset.z,
      y: y + sinYaw * this.rigOriginOffset.x - cosYaw * this.rigOriginOffset.z,
      z: z - PLAYER_GROUND_VISUAL_OFFSET_CELLS - this.rigOriginOffset.y,
      yaw: visualYaw,
      showBones: false,
    });
    const color = this.damageFlashUntilMs > performance.now() ? 0xff5555 : tint;
    for (const mesh of this.renderer.getPickMeshes()) {
      const layer = String(mesh.userData.bucketKey).split(':')[0]! as keyof typeof DEFAULT_PALETTE;
      (mesh.material as MeshStandardMaterial).color.setHex(
        color ?? DEFAULT_PALETTE[layer] ?? DEFAULT_PALETTE.flesh,
      );
    }
  }

  /** Mantiene un destello breve cuando el servidor confirma daño recibido. */
  flashDamage(): void {
    this.damageFlashUntilMs = performance.now() + 180;
  }

  /** Ajusta transparencia para usar el rig como fantasma de depuración. */
  setOpacity(opacity: number): void {
    for (const mesh of this.renderer.getPickMeshes()) {
      const material = mesh.material as MeshStandardMaterial;
      material.transparent = opacity < 1;
      material.opacity = opacity;
      material.depthWrite = opacity >= 1;
      material.needsUpdate = true;
    }
  }

  /** Libera el renderer al desaparecer una réplica remota. */
  dispose(): void {
    this.renderer.dispose();
  }
}
