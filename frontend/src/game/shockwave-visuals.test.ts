import assert from 'node:assert/strict';
import test from 'node:test';
import { shockwaveRadius } from './shockwave-visuals.ts';

test('shockwave ring expands to the impact radius and clamps progress', () => {
  assert.equal(shockwaveRadius(-1, 3.5), 0);
  assert.equal(shockwaveRadius(0.5, 3.5), 1.75);
  assert.equal(shockwaveRadius(2, 3.5), 3.5);
});
