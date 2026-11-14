import assert from 'node:assert/strict';
import test from 'node:test';
import { isNewActionSequence, selectRemoteClip } from './remote-animation.ts';

test('remote clips follow authoritative action and movement state', () => {
  const base = { medium: 'ground', vx: 0, vy: 0, vz: 0 };
  assert.equal(selectRemoteClip({ ...base, intents: { move_forward: true } }), 'walk');
  assert.equal(selectRemoteClip({ ...base, vx: 1, intents: { run_forward: true } }), 'run');
  assert.equal(selectRemoteClip({ ...base, intents: { attack_light: true } }), null);
  assert.equal(selectRemoteClip({ ...base, action_id: 'attack' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'kamehameha' }), 'kamehameha');
  assert.equal(selectRemoteClip({ ...base, medium: 'submerged_full', vx: 1 }), 'swim');
  assert.equal(selectRemoteClip({ ...base, medium: 'air', intents: { move_forward: true } }), 'fly');
  assert.equal(selectRemoteClip({ ...base, medium: 'air', vz: 1 }), 'jump');
});

test('first accepted action sequence is played, duplicates and old events are ignored', () => {
  assert.equal(isNewActionSequence(null, 1), true);
  assert.equal(isNewActionSequence(1, 1), false);
  assert.equal(isNewActionSequence(2, 1), false);
  assert.equal(isNewActionSequence(1, 2), true);
});
