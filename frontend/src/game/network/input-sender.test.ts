import assert from 'node:assert/strict';
import test from 'node:test';
import { hasNewAttackIntent } from './input-sender.ts';

test('tracks F and G edges together when both become active', () => {
  const wasActive = { attack_light: false, attack_projectile: false };
  assert.equal(hasNewAttackIntent({ attack_light: true, attack_projectile: true }, wasActive), true);
  assert.deepEqual(wasActive, { attack_light: true, attack_projectile: true });
  assert.equal(hasNewAttackIntent({ attack_light: true, attack_projectile: true }, wasActive), false);
});

test('re-pressing either attack after release creates a new edge', () => {
  const wasActive = { attack_light: false, attack_projectile: false };
  assert.equal(hasNewAttackIntent({ attack_light: true }, wasActive), true);
  assert.equal(hasNewAttackIntent({}, wasActive), false);
  assert.equal(hasNewAttackIntent({ attack_light: true }, wasActive), true);
  assert.equal(hasNewAttackIntent({ attack_projectile: true }, wasActive), true);
});
