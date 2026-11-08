/**
 * Renderiza el jugador local con el rig y los clips del Character Studio.
 */

import { buildRig, SkeletonPose } from '@/poc/character-studio/rig-math';
import { createDefaultClipLibrary, sampleClip } from '@/poc/character-studio/studio-clip';
import { defaultBipedDocument } from '@/poc/character-studio/studio-document';
import { StudioRenderer } from '@/poc/character-studio/studio-renderer';
import type { StudioAnimationClip } from '@/poc/character-studio/types';
import { DEFAULT_PALETTE } from '@/poc/shared';
import { MeshStandardMaterial, type Scene } from 'three';

// Compensa el origen del rig y la separación entre la celda física y la cara visible del voxel.
const PLAYER_GROUND_VISUAL_OFFSET_CELLS = 0.94;

export class PlayerCharacterVisual {
  private readonly doc = defaultBipedDocument();
  private readonly pose = new SkeletonPose(buildRig(this.doc), this.doc);
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
    this.renderer.sync(this.doc, this.pose, {
      x,
      y,
      z: z - PLAYER_GROUND_VISUAL_OFFSET_CELLS,
      yaw: yaw + Math.PI / 2,
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
