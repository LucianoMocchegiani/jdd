import assert from 'node:assert/strict';
import test from 'node:test';
import { Scene, Vector3 } from 'three';
import { buildRig, SkeletonPose } from './rig-math.ts';
import { defaultBipedDocument } from './studio-document.ts';
import { StudioRenderer } from './studio-renderer.ts';

test('bone world position follows the rendered pose and transform', () => {
  const doc = defaultBipedDocument();
  const pose = new SkeletonPose(buildRig(doc), doc);
  const renderer = new StudioRenderer(new Scene(), 2);
  const yaw = 0.7;
  renderer.sync(doc, pose, { x: 3, y: 4, z: 5, yaw, showBones: false });

  const local = new Vector3().setFromMatrixPosition(pose.boneWorldMatrix('muneca-derecha'));
  const expected = local.multiplyScalar(2).applyAxisAngle(new Vector3(0, 1, 0), yaw).add(new Vector3(6, 10, 8));
  assert.ok(renderer.getBoneWorldPosition(pose, 'muneca-derecha').distanceTo(expected) < 1e-9);
  renderer.dispose();
});
