/**
 * Gizmo de edición (T/R/S) para elementos y pivotes de hueso — modo Editar.
 *
 * @module character-studio/studio-edit-gizmo
 */

import type { SkeletonPose } from '@/poc/character-studio/rig-math';
import type { EditSelection, GizmoMode } from '@/poc/character-studio/studio-document-ops';
import { findBone, findElement } from '@/poc/character-studio/studio-document-ops';
import type { StudioDocument, Vec3 } from '@/poc/character-studio/types';
import { Camera, Euler, Matrix4, Object3D, Quaternion, Scene, Vector3, WebGLRenderer } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const _euler = new Euler();
const _quat = new Quaternion();
const _pos = new Vector3();
const _scl = new Vector3();
const _charWorld = new Matrix4();
const _invCharWorld = new Matrix4();
const _boneWorld = new Matrix4();
const _invBoneWorld = new Matrix4();
const _elLocal = new Matrix4();
const _scratch = new Matrix4();

export interface StudioEditGizmoCallbacks {
  getSelection: () => EditSelection | null;
  getGizmoMode: () => GizmoMode;
  getDoc: () => StudioDocument;
  getPose: () => SkeletonPose;
  getCharWorld: () => Matrix4;
  isEnabled: () => boolean;
  onElementChange: (id: string, patch: { pos?: Vec3; rot?: Vec3; scale?: Vec3 }) => void;
  onBonePivotChange: (id: string, pivot: Vec3) => void;
  onBoneRotChange: (id: string, rot: Vec3) => void;
  onDragEnd?: () => void;
}

export class StudioEditGizmo {
  readonly controls: TransformControls;
  private readonly anchor = new Object3D();
  private readonly cb: StudioEditGizmoCallbacks;
  private targetKey: string | null = null;
  private suppressChange = false;

  constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer, callbacks: StudioEditGizmoCallbacks) {
    this.cb = callbacks;
    scene.add(this.anchor);

    this.controls = new TransformControls(camera, renderer.domElement);
    this.controls.attach(this.anchor);
    this.controls.setSpace('local');
    this.controls.size = 0.65;
    scene.add(this.controls.getHelper());

    this.controls.addEventListener('dragging-changed', (ev) => {
      const dragging = (ev as { value: boolean }).value;
      renderer.domElement.style.touchAction = dragging ? 'none' : '';
      if (!dragging) this.cb.onDragEnd?.();
    });

    this.controls.addEventListener('objectChange', () => this.onAnchorChanged());
  }

  setMode(mode: GizmoMode): void {
    this.controls.setMode(mode);
  }

  sync(): void {
    if (!this.cb.isEnabled()) {
      this.controls.enabled = false;
      this.anchor.visible = false;
      this.targetKey = null;
      return;
    }

    const sel = this.cb.getSelection();
    const gizmoMode = this.cb.getGizmoMode();
    this.controls.setMode(gizmoMode);

    if (!sel) {
      this.controls.enabled = false;
      this.anchor.visible = false;
      this.targetKey = null;
      return;
    }

    const doc = this.cb.getDoc();
    const pose = this.cb.getPose();
    const base = doc.gridStep;
    _charWorld.copy(this.cb.getCharWorld());
    _invCharWorld.copy(_charWorld).invert();

    const key = `${sel.kind}:${sel.id}`;
    if (key !== this.targetKey) this.targetKey = key;

    this.controls.enabled = true;
    this.anchor.visible = true;
    this.controls.showX = true;
    this.controls.showY = true;
    this.controls.showZ = true;

    if (sel.kind === 'element') {
      const el = findElement(doc, sel.id);
      if (!el) return;
      const elWorld = pose.elementWorldMatrix(el).premultiply(_charWorld);
      elWorld.decompose(_pos, _quat, _scl);
      this.suppressChange = true;
      this.anchor.position.copy(_pos);
      this.anchor.quaternion.copy(_quat);
      this.anchor.scale.set(base * el.scale[0], base * el.scale[1], base * el.scale[2]);
      this.suppressChange = false;
      return;
    }

    const bone = findBone(doc, sel.id);
    if (!bone) return;
    _boneWorld.copy(pose.boneWorldMatrix(bone.id)).premultiply(_charWorld);
    _boneWorld.decompose(_pos, _quat, _scl);
    if (gizmoMode === 'scale') this.controls.setMode('translate');
    this.suppressChange = true;
    this.anchor.position.copy(_pos);
    this.anchor.quaternion.copy(_quat);
    this.anchor.scale.set(1, 1, 1);
    this.suppressChange = false;
  }

  private onAnchorChanged(): void {
    if (this.suppressChange) return;
    const sel = this.cb.getSelection();
    if (!sel) return;

    const doc = this.cb.getDoc();
    const pose = this.cb.getPose();
    const mode = this.cb.getGizmoMode();
    _charWorld.copy(this.cb.getCharWorld());
    _invCharWorld.copy(_charWorld).invert();
    const base = doc.gridStep;

    this.anchor.updateMatrixWorld(true);
    _scratch.copy(this.anchor.matrixWorld).premultiply(_invCharWorld);

    if (sel.kind === 'element') {
      const el = findElement(doc, sel.id);
      if (!el) return;
      _boneWorld.copy(pose.boneWorldMatrix(el.boneId));
      _invBoneWorld.copy(_boneWorld).invert();
      _elLocal.copy(_invBoneWorld).multiply(_scratch);
      _elLocal.decompose(_pos, _quat, _scl);
      _euler.setFromQuaternion(_quat, 'XYZ');

      const patch: { pos?: Vec3; rot?: Vec3; scale?: Vec3 } = {};
      if (mode === 'translate') {
        patch.pos = [_pos.x, _pos.y, _pos.z];
      } else if (mode === 'rotate') {
        patch.rot = [_euler.x, _euler.y, _euler.z];
      } else if (mode === 'scale' && base > 0) {
        patch.scale = [_scl.x / base, _scl.y / base, _scl.z / base];
      }
      this.cb.onElementChange(el.id, patch);
      return;
    }

    const bone = findBone(doc, sel.id);
    if (!bone) return;

    if (mode === 'translate') {
      _scratch.decompose(_pos, _quat, _scl);
      this.cb.onBonePivotChange(bone.id, [_pos.x, _pos.y, _pos.z]);
    } else if (mode === 'rotate') {
      _euler.setFromQuaternion(this.anchor.quaternion, 'XYZ');
      this.cb.onBoneRotChange(bone.id, [_euler.x, _euler.y, _euler.z]);
    }
  }

  dispose(): void {
    this.controls.detach();
    this.controls.dispose();
    this.anchor.removeFromParent();
  }
}
