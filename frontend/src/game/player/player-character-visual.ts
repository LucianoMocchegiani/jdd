/**
 * Renderiza el jugador local con el rig y los clips del Character Studio.
 */

import { buildRig, SkeletonPose } from '@/poc/character-studio/rig-math';
import { sampleClip, createDefaultClipLibrary } from '@/poc/character-studio/studio-clip';
import { defaultBipedDocument } from '@/poc/character-studio/studio-document';
import { StudioRenderer } from '@/poc/character-studio/studio-renderer';
import { DEFAULT_PALETTE } from '@/poc/shared';
import type { StudioAnimationClip } from '@/poc/character-studio/types';
import { MeshStandardMaterial, type Scene } from 'three';

export class PlayerCharacterVisual {
  private readonly doc = defaultBipedDocument();
  private readonly pose = new SkeletonPose(buildRig(this.doc), this.doc);
  private readonly renderer: StudioRenderer;
  private readonly clips = new Map<string, StudioAnimationClip>(
    createDefaultClipLibrary(this.doc.bones).clips.map((clip) => [clip.id, clip]),
  );
  private clipId = 'idle';
  private time = 0;

  constructor(scene: Scene, private readonly cellSize: number) {
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
    const keepOneShot = !current.loop && this.time < current.duration && (!requestedAnimation || requestedAnimation.loop);
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
    this.renderer.sync(this.doc, this.pose, { x, y, z, yaw, showBones: false });

    const palette = DEFAULT_PALETTE as Record<string, number>;
    for (const mesh of this.renderer.getPickMeshes()) {
      const layer = String(mesh.userData.bucketKey).split(':')[0]!;
      (mesh.material as MeshStandardMaterial).color.setHex(tint ?? palette[layer] ?? DEFAULT_PALETTE.flesh);
    }
  }
}
