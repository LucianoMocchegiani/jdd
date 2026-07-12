/**
 * Cinemática directa (FK) por matrices Three.
 *
 * @module character-studio/rig-math
 */

import type { BuiltRig, StudioBone, StudioDocument, StudioElement, Vec3 } from '@/poc/character-studio/types';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

const _euler = new Euler();
const _quat = new Quaternion();
const _pos = new Vector3();
const _scale = new Vector3();
const _parent = new Matrix4();
const _local = new Matrix4();
const _scratch = new Matrix4();

/** {@link Vec3} → `Vector3` de Three. */
function vec3ToVector(v: Vec3): Vector3 {
  return new Vector3(v[0], v[1], v[2]);
}

function matrixFromTRS(pos: Vec3, rot: Vec3, scale: Vec3 = [1, 1, 1]): Matrix4 {
  _pos.copy(vec3ToVector(pos));
  _euler.set(rot[0], rot[1], rot[2], 'XYZ');
  _quat.setFromEuler(_euler);
  _scale.set(scale[0], scale[1], scale[2]);
  return new Matrix4().compose(_pos, _quat, _scale);
}

function matrixFromPivotRot(pivot: Vec3, rot: Vec3 = [0, 0, 0]): Matrix4 {
  return matrixFromTRS(pivot, rot, [1, 1, 1]);
}

function topologicalBones(bones: StudioBone[]): StudioBone[] {
  const out: StudioBone[] = [];
  const pending = new Set(bones.map((b) => b.id));
  const byId = new Map(bones.map((b) => [b.id, b]));

  while (pending.size > 0) {
    let progressed = false;
    for (const id of [...pending]) {
      const b = byId.get(id)!;
      if (!b.parentId || !pending.has(b.parentId)) {
        out.push(b);
        pending.delete(id);
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return out;
}

/** Construye el rig cacheado desde un documento v2. */
export function buildRig(doc: StudioDocument): BuiltRig {
  const boneById = new Map(doc.bones.map((b) => [b.id, b]));
  const elementById = new Map(doc.elements.map((e) => [e.id, e]));
  const rootBoneId = doc.bones.find((b) => b.parentId === null)?.id ?? doc.bones[0]!.id;

  const boneBindWorld = new Map<string, Matrix4>();
  const boneLocalBind = new Map<string, Matrix4>();
  const elementLocal = new Map<string, Matrix4>();

  for (const bone of topologicalBones(doc.bones)) {
    const rot = bone.rot ?? [0, 0, 0];
    const worldBind = matrixFromPivotRot(bone.pivot, rot);
    boneBindWorld.set(bone.id, worldBind);

    if (bone.parentId) {
      const parentBind = boneBindWorld.get(bone.parentId)!;
      boneLocalBind.set(bone.id, new Matrix4().copy(parentBind).invert().multiply(worldBind));
    } else {
      boneLocalBind.set(bone.id, worldBind.clone());
    }
  }

  for (const el of doc.elements) {
    elementLocal.set(el.id, matrixFromTRS(el.pos, el.rot, [1, 1, 1]));
  }

  return {
    boneBindWorld,
    boneLocalBind,
    elementLocal,
    boneById,
    elementById,
    rootBoneId,
  };
}

/** Pose FK — rotación Euler absoluta por hueso. */
export class SkeletonPose {
  private readonly rig: BuiltRig;
  private readonly bindRot = new Map<string, Vec3>();
  private readonly boneRot = new Map<string, Vec3>();

  readonly boneWorld = new Map<string, Matrix4>();

  constructor(rig: BuiltRig, doc: StudioDocument) {
    this.rig = rig;
    for (const bone of doc.bones) {
      const br: Vec3 = bone.rot ? [...bone.rot] : [0, 0, 0];
      this.bindRot.set(bone.id, br);
      this.boneRot.set(bone.id, [...br]);
    }
    this.rebuild();
  }

  getBoneRot(boneId: string): Vec3 {
    const r = this.boneRot.get(boneId);
    return r ? [...r] : [0, 0, 0];
  }

  setBoneRot(boneId: string, rot: Vec3): void {
    if (!this.rig.boneById.has(boneId)) return;
    this.boneRot.set(boneId, [...rot]);
    this.rebuild();
  }

  setBoneRots(rots: Map<string, Vec3>): void {
    for (const [id, rot] of rots) {
      if (!this.rig.boneById.has(id)) continue;
      this.boneRot.set(id, [...rot]);
    }
    this.rebuild();
  }

  resetToBind(): void {
    for (const [id, rot] of this.bindRot) {
      this.boneRot.set(id, [...rot]);
    }
    this.rebuild();
  }

  rebuild(): void {
    this.boneWorld.clear();
    const order = topologicalBones([...this.rig.boneById.values()]);

    for (const bone of order) {
      const localBind = this.rig.boneLocalBind.get(bone.id)!;
      const rot = this.boneRot.get(bone.id) ?? this.bindRot.get(bone.id) ?? [0, 0, 0];

      localBind.decompose(_pos, _quat, _scale);
      _euler.set(rot[0], rot[1], rot[2], 'XYZ');
      _quat.setFromEuler(_euler);
      _local.compose(_pos, _quat, _scale);

      if (bone.parentId) {
        const pw = this.boneWorld.get(bone.parentId);
        if (!pw) {
          console.warn(`[character-studio] hueso padre ausente: ${bone.parentId}`);
          _parent.identity();
        } else {
          _parent.copy(pw);
        }
      } else {
        _parent.identity();
      }

      this.boneWorld.set(bone.id, new Matrix4().multiplyMatrices(_parent, _local));
    }
  }

  elementWorldMatrix(element: StudioElement): Matrix4 {
    const boneW = this.boneWorld.get(element.boneId);
    const elLocal = this.rig.elementLocal.get(element.id);
    if (!boneW || !elLocal) return new Matrix4();
    return _scratch.copy(boneW).multiply(elLocal);
  }

  boneWorldMatrix(boneId: string): Matrix4 {
    return this.boneWorld.get(boneId)?.clone() ?? new Matrix4();
  }
}
