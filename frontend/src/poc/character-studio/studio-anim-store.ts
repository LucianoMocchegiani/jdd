/**
 * Estado de animación — librería de clips, auto-key, FPS y hueso seleccionado.
 *
 * @module character-studio/studio-anim-store
 */

import type { SkeletonPose } from '@/poc/character-studio/rig-math';
import {
  clearClipToBind,
  createDefaultClipLibrary,
  getActiveClip,
  hasKeyframeAt,
  removeKeyframe,
  setKeyframe,
  snapTime,
  upsertClip,
} from '@/poc/character-studio/studio-clip';
import type {
  StudioAnimationClip,
  StudioBone,
  StudioClipLibrary,
  StudioDocument,
  StudioFps,
  Vec3,
} from '@/poc/character-studio/types';

export interface StudioAnimStoreOptions {
  doc: StudioDocument;
  fps?: StudioFps;
}

/** Gestiona clips, reproducción y escritura de keyframes. */
export class StudioAnimStore {
  library: StudioClipLibrary;
  fps: StudioFps;
  autoKey = false;
  selectedBoneId: string | null = null;

  private bones: StudioBone[];

  constructor(opts: StudioAnimStoreOptions) {
    this.bones = opts.doc.bones;
    this.fps = opts.fps ?? 30;
    this.library = createDefaultClipLibrary(this.bones, this.fps);
    this.selectedBoneId = this.bones.find((b) => b.id !== 'controller')?.id ?? null;
  }

  get activeClip(): StudioAnimationClip {
    return getActiveClip(this.library);
  }

  setActiveClip(id: string): void {
    if (this.library.clips.some((c) => c.id === id)) {
      this.library.activeId = id;
    }
  }

  reloadDocument(doc: StudioDocument): void {
    this.bones.length = 0;
    this.bones.push(...doc.bones);
    this.library = createDefaultClipLibrary(doc.bones, this.fps);
    this.selectedBoneId = doc.bones.find((b) => b.id !== 'controller')?.id ?? null;
  }

  selectBone(boneId: string | null): void {
    this.selectedBoneId = boneId;
  }

  /** Auto-key: un hueso por movimiento. */
  saveKeyframeAt(pose: SkeletonPose, time: number, boneId?: string): void {
    const id = boneId ?? this.selectedBoneId;
    if (!id) return;
    const t = snapTime(time, this.fps);
    const clip = this.activeClip;
    setKeyframe(clip, id, t, pose.getBoneRot(id), 'linear', this.fps);
    upsertClip(this.library, clip);
  }

  /** Guarda pose completa del esqueleto en el tiempo. */
  bakePoseAt(pose: SkeletonPose, time: number): void {
    const t = snapTime(time, this.fps);
    const clip = this.activeClip;
    for (const bone of this.bones) {
      setKeyframe(clip, bone.id, t, pose.getBoneRot(bone.id), 'linear', this.fps);
    }
    upsertClip(this.library, clip);
  }

  hasPoseKeyframeAt(time: number): boolean {
    const t = snapTime(time, this.fps);
    const clip = this.activeClip;
    return this.bones.some((bone) => hasKeyframeAt(clip, bone.id, t, this.fps));
  }

  deletePoseAt(time: number): void {
    const t = snapTime(time, this.fps);
    const clip = this.activeClip;
    for (const bone of this.bones) {
      removeKeyframe(clip, bone.id, t, this.fps);
    }
    upsertClip(this.library, clip);
  }

  maybeAutoKey(pose: SkeletonPose, time: number, boneId: string): void {
    if (!this.autoKey) return;
    this.saveKeyframeAt(pose, time, boneId);
  }

  keyTimesForBone(boneId: string): number[] {
    const tr = this.activeClip.tracks.find((x) => x.boneId === boneId);
    return tr?.keys.map((k) => k.t) ?? [];
  }

  clearActiveClip(): void {
    const clip = this.activeClip;
    clearClipToBind(clip, this.bones);
    upsertClip(this.library, clip);
  }

  /** Actualiza pistas y selección tras renombrar un hueso en el documento. */
  renameBone(oldId: string, newId: string): void {
    if (oldId === newId) return;
    if (this.selectedBoneId === oldId) this.selectedBoneId = newId;
    const bone = this.bones.find((b) => b.id === oldId);
    if (bone) bone.id = newId;
    for (const clip of this.library.clips) {
      for (const tr of clip.tracks) {
        if (tr.boneId === oldId) tr.boneId = newId;
      }
    }
  }

  importClip(clip: StudioAnimationClip): { skippedBones: string[] } {
    const boneIds = new Set(this.bones.map((b) => b.id));
    const skipped = new Set<string>();
    const tracks = clip.tracks.filter((tr) => {
      if (boneIds.has(tr.boneId)) return true;
      skipped.add(tr.boneId);
      return false;
    });

    const imported: StudioAnimationClip = { ...clip, tracks: tracks.map((t) => ({ ...t, keys: [...t.keys] })) };
    upsertClip(this.library, imported);
    this.library.activeId = imported.id;
    if (imported.fps === 24 || imported.fps === 30 || imported.fps === 60) {
      this.fps = imported.fps;
    }
    return { skippedBones: [...skipped] };
  }

  setBoneRot(pose: SkeletonPose, boneId: string, rot: Vec3, time: number): void {
    pose.setBoneRot(boneId, rot);
    this.maybeAutoKey(pose, time, boneId);
  }
}
