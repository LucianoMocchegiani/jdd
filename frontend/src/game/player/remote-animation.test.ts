import assert from 'node:assert/strict';
import test from 'node:test';
import { isNewActionSequence, resolveRemoteClipId, selectRemoteClip } from './remote-animation.ts';

test('remote clips follow authoritative action and movement state', () => {
  const base = { medium: 'ground', vx: 0, vy: 0, vz: 0, yaw: 0 };
  assert.equal(selectRemoteClip({ ...base, intents: { move_forward: true } }), 'walk_forward');
  assert.equal(selectRemoteClip({ ...base, vx: 1, intents: { run_forward: true } }), 'run_forward');
  assert.equal(selectRemoteClip({ ...base, intents: { move_left: true } }), 'walk_left');
  assert.equal(selectRemoteClip({ ...base, intents: { move_right: true } }), 'walk_right');
  assert.equal(selectRemoteClip({ ...base, intents: { move_backward: true, run_backward: true } }), 'run_backward');
  assert.equal(selectRemoteClip({ ...base, intents: { attack_light: true } }), null);
  assert.equal(selectRemoteClip({ ...base, action_id: 'attack' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'golpe_pesado' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'onda_de_choque' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'escudo_de_ki' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esquive_rapido', intents: { move_left: true } }), 'esquive_rapido_left');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esquive_rapido', intents: { move_right: true } }), 'esquive_rapido_right');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esquive_rapido', intents: { move_backward: true } }), 'esquive_rapido_backward');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esquive_rapido' }), 'esquive_rapido_forward');
  for (const [vx, vy, direction] of [[0, -1, 'forward'], [0, 1, 'backward'], [-1, 0, 'left'], [1, 0, 'right']] as const) {
    assert.equal(selectRemoteClip({ ...base, vx, vy, action_id: 'esquive_rapido' }), `esquive_rapido_${direction}`);
  }
  assert.equal(selectRemoteClip({ ...base, action_id: 'kamehameha' }), 'kamehameha');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esfera_rapida' }), 'kamehameha');
  assert.equal(selectRemoteClip({ ...base, action_id: 'orbe_explosivo' }), 'orbe_explosivo');
  assert.equal(selectRemoteClip({ ...base, action_id: 'trueno' }), 'trueno');
  assert.equal(selectRemoteClip({ ...base, continuous_attack_active: true }), 'rayo_de_ki');
  assert.equal(selectRemoteClip({ ...base, intents: { continuous_attack: true } }), 'rayo_de_ki');
  assert.equal(selectRemoteClip({ ...base, continuous_action_id: 'aura_de_ki', continuous_attack_active: true }), 'aura_de_ki');
  assert.equal(selectRemoteClip({ ...base, intents: { continuous_aura: true } }), 'aura_de_ki');
  assert.equal(selectRemoteClip({ ...base, continuous_action_id: 'escudo_radial_de_ki', continuous_attack_active: true }), 'escudo_radial_de_ki');
  assert.equal(selectRemoteClip({ ...base, intents: { continuous_ki_shield: true } }), 'escudo_radial_de_ki');
  assert.equal(selectRemoteClip({ ...base, medium: 'submerged_partial', vx: 1 }), 'swim');
  assert.equal(selectRemoteClip({ ...base, medium: 'submerged_full', vx: 1, intents: { move_left: true } }), 'swim');
  assert.equal(selectRemoteClip({ ...base, medium: 'air', intents: { move_forward: true } }), 'fly');
  assert.equal(selectRemoteClip({ ...base, medium: 'air', vz: 1 }), 'jump');
});

test('directional clips fall back to existing clips until variants are added', () => {
  const baseClips = new Map([['walk', {}], ['esquive_rapido', {}]]);
  assert.equal(resolveRemoteClipId('walk_left', baseClips), 'walk');
  assert.equal(resolveRemoteClipId('esquive_rapido_backward', baseClips), 'esquive_rapido');
  assert.equal(resolveRemoteClipId('run_forward', baseClips), 'walk');
  const directionalClips = new Map([...baseClips, ['walk_left', {}]]);
  assert.equal(resolveRemoteClipId('walk_left', directionalClips), 'walk_left');
});

test('first accepted action sequence is played, duplicates and old events are ignored', () => {
  assert.equal(isNewActionSequence(null, 1), true);
  assert.equal(isNewActionSequence(1, 1), false);
  assert.equal(isNewActionSequence(2, 1), false);
  assert.equal(isNewActionSequence(1, 2), true);
});
