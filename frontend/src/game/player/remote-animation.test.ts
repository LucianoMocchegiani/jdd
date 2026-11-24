import assert from 'node:assert/strict';
import test from 'node:test';
import { isNewActionSequence, selectRemoteClip } from './remote-animation.ts';

test('remote clips follow authoritative action and movement state', () => {
  const base = { medium: 'ground', vx: 0, vy: 0, vz: 0 };
  assert.equal(selectRemoteClip({ ...base, intents: { move_forward: true } }), 'walk');
  assert.equal(selectRemoteClip({ ...base, vx: 1, intents: { run_forward: true } }), 'run');
  assert.equal(selectRemoteClip({ ...base, intents: { attack_light: true } }), null);
  assert.equal(selectRemoteClip({ ...base, action_id: 'attack' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'golpe_pesado' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'onda_de_choque' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'escudo_de_ki' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esquive_rapido' }), 'esquive_rapido');
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
