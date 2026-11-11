import assert from 'node:assert/strict';
import test from 'node:test';
import { particleColumnIndex } from './particle-cell.ts';

test('particle columns choose the nearest integer-centered cell', () => {
  assert.equal(particleColumnIndex(120.49), 120);
  assert.equal(particleColumnIndex(120.5), 121);
  assert.equal(particleColumnIndex(-0.49), 0);
  assert.equal(particleColumnIndex(-0.5), 0);
  assert.equal(particleColumnIndex(-0.51), -1);
});
