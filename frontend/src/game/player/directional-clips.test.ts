import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectionalPlayerClips } from './directional-clips.ts';
import type { StudioAnimationClip } from '@/poc/character-studio/types';

const clip = (id: string, loop: boolean): StudioAnimationClip => ({
  version: 2,
  id,
  label: id,
  duration: 1,
  loop,
  fps: 30,
  tracks: [
    { boneId: 'cadera-derecha', keys: [{ t: 0, rot: [0, 0, 0.4] }, { t: 1, rot: [0, 0, -0.4] }] },
    { boneId: 'controller', keys: [{ t: 0, rot: [1, 0, 0] }, { t: 1, rot: [0, 0, 0] }] },
  ],
});

test('creates distinct walk, run, and dodge clips for each cardinal direction', () => {
  const clips = createDirectionalPlayerClips(clip('walk', true), clip('esquive_rapido', false));
  assert.equal(clips.length, 12);
  for (const action of ['walk', 'run', 'esquive_rapido']) {
    for (const direction of ['forward', 'backward', 'left', 'right']) {
      assert.ok(clips.some((animation) => animation.id === `${action}_${direction}`));
    }
  }
  assert.notEqual(clips.find((animation) => animation.id === 'run_forward')?.duration, clips.find((animation) => animation.id === 'walk_forward')?.duration);
  assert.notDeepEqual(
    clips.find((animation) => animation.id === 'walk_forward')?.tracks,
    clips.find((animation) => animation.id === 'walk_left')?.tracks,
  );
  assert.equal(clips.find((animation) => animation.id === 'esquive_rapido_left')?.loop, false);
});
