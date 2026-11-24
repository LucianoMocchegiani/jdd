import assert from 'node:assert/strict';
import test from 'node:test';
import { clipFromJson } from '@/poc/character-studio/studio-clip';
import walkRaw from '@/poc/walk.json?raw';
import dodgeRaw from '@/game/player/animations/esquive_rapido.json?raw';
import { createDirectionalPlayerClips } from './directional-clips.ts';

test('creates distinct walk, run, and dodge clips for each cardinal direction', () => {
  const clips = createDirectionalPlayerClips(clipFromJson(walkRaw), clipFromJson(dodgeRaw));
  assert.equal(clips.length, 12);
  for (const action of ['walk', 'run', 'esquive_rapido']) {
    for (const direction of ['forward', 'backward', 'left', 'right']) {
      assert.ok(clips.some((clip) => clip.id === `${action}_${direction}`));
    }
  }
  assert.notEqual(clips.find((clip) => clip.id === 'run_forward')?.duration, clips.find((clip) => clip.id === 'walk_forward')?.duration);
  assert.notDeepEqual(
    clips.find((clip) => clip.id === 'walk_forward')?.tracks,
    clips.find((clip) => clip.id === 'walk_left')?.tracks,
  );
  assert.equal(clips.find((clip) => clip.id === 'esquive_rapido_left')?.loop, false);
});
