import assert from 'node:assert/strict';
import test from 'node:test';
import { kiShieldForward, shockwaveRadius } from './shockwave-visuals.ts';

test('shockwave ring expands to the impact radius and clamps progress', () => {
  assert.equal(shockwaveRadius(-1, 3.5), 0);
  assert.equal(shockwaveRadius(0.5, 3.5), 1.75);
  assert.equal(shockwaveRadius(2, 3.5), 3.5);
});

test('ki shield faces the same forward direction as server projectiles', () => {
  assert.deepEqual(kiShieldForward(0), { x: 0, y: -1 });
  assert.ok(Math.abs(kiShieldForward(Math.PI / 2).x + 1) < 1e-10);
});
