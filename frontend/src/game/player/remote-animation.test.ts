import assert from 'node:assert/strict';
import test from 'node:test';
import { selectRemoteClip } from './remote-animation.ts';

test('remote clips follow transmitted action and movement state', () => {
  const base = { medium: 'ground', vx: 0, vy: 0, vz: 0 };
  assert.equal(selectRemoteClip({ ...base, intents: { move_forward: true } }), 'walk');
  assert.equal(selectRemoteClip({ ...base, vx: 1, intents: { run_forward: true } }), 'run');
  assert.equal(selectRemoteClip({ ...base, intents: { attack_light: true } }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'kamehameha' }), 'kamehameha');
  assert.equal(selectRemoteClip({ ...base, action_id: 'attack' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, medium: 'submerged_full', vx: 1 }), 'swim');
  assert.equal(selectRemoteClip({ ...base, medium: 'air', intents: { move_forward: true } }), 'fly');
  assert.equal(selectRemoteClip({ ...base, medium: 'air', vz: 1 }), 'jump');
  assert.equal(selectRemoteClip(base), null);
});
