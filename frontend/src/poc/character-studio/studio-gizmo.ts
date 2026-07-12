/**
 * Gizmo de rotación en viewport (TransformControls) — modo Animar.
 *
 * @module character-studio/studio-gizmo
 */

import type { SkeletonPose } from '@/poc/character-studio/rig-math';
import type { StudioBone, Vec3 } from '@/poc/character-studio/types';
import { Camera, Euler, Matrix4, Object3D, Quaternion, Scene, Vector3, WebGLRenderer } from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

const _euler = new Euler();
const _quat = new Quaternion();
const _pos = new Vector3();
const _scl = new Vector3();
const _boneWorld = new Matrix4();
const _charWorld = new Matrix4();

export interface StudioGizmoCallbacks {
  getSelectedBoneId: () => string | null;
  getBone: (id: string) => StudioBone | undefined;
  getPose: () => SkeletonPose;
  getCharWorld: () => Matrix4;
  onRotChange: (boneId: string, rot: Vec3) => void;
  isEnabled: () => boolean;
}

/**
 * Ancla un TransformControls al pivote del hueso seleccionado.
 */
export class StudioBoneGizmo {
  readonly controls: TransformControls;
  private readonly anchor = new Object3D();
  private readonly cb: StudioGizmoCallbacks;
  private attachedBoneId: string | null = null;
  private suppressChange = false;

  constructor(scene: Scene, camera: Camera, renderer: WebGLRenderer, callbacks: StudioGizmoCallbacks) {
    this.cb = callbacks;
    scene.add(this.anchor);

    this.controls = new TransformControls(camera, renderer.domElement);
    this.controls.setMode('rotate');
    this.controls.setSpace('local');
    this.controls.attach(this.anchor);
    this.controls.showX = true;
    this.controls.showY = true;
    this.controls.showZ = true;
    this.controls.size = 0.65;
    scene.add(this.controls.getHelper());

    this.controls.addEventListener('dragging-changed', (ev) => {
      const dragging = (ev as { value: boolean }).value;
      renderer.domElement.style.touchAction = dragging ? 'none' : '';
    });

    this.controls.addEventListener('objectChange', () => {
      if (this.suppressChange || !this.attachedBoneId) return;
      _euler.setFromQuaternion(this.anchor.quaternion, 'XYZ');
      const rot: Vec3 = [_euler.x, _euler.y, _euler.z];
      this.cb.onRotChange(this.attachedBoneId, rot);
    });
  }

  /** Actualiza posición/orientación del ancla según pose y hueso seleccionado. */
  sync(): void {
    if (!this.cb.isEnabled()) {
      this.controls.enabled = false;
      this.anchor.visible = false;
      this.attachedBoneId = null;
      return;
    }

    const boneId = this.cb.getSelectedBoneId();
    if (!boneId) {
      this.controls.enabled = false;
      this.anchor.visible = false;
      this.attachedBoneId = null;
      return;
    }

    const bone = this.cb.getBone(boneId);
    if (!bone) return;

    this.attachedBoneId = boneId;
    this.controls.enabled = true;
    this.anchor.visible = true;

    const pose = this.cb.getPose();
    _charWorld.copy(this.cb.getCharWorld());
    _boneWorld.copy(pose.boneWorldMatrix(boneId)).premultiply(_charWorld);
    _boneWorld.decompose(_pos, _quat, _scl);

    this.suppressChange = true;
    this.anchor.position.copy(_pos);
    this.anchor.quaternion.copy(_quat);
    this.anchor.scale.set(1, 1, 1);
    this.suppressChange = false;
  }

  dispose(): void {
    this.controls.detach();
    this.controls.dispose();
    this.anchor.removeFromParent();
  }
}
