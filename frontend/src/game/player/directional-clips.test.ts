import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const { clips } = JSON.parse(readFileSync(new URL('./animations/directional_player_clips.json', import.meta.url), 'utf8')) as {
  clips: Array<{ id: string; duration: number; loop: boolean; tracks: Array<{ boneId: string; keys: Array<{ t: number; rot: number[] }> }> }>;
};

test('directional animation JSON contains valid walk, run, and dodge variants', () => {
  assert.equal(clips.length, 12);
  for (const action of ['walk', 'run', 'esquive_rapido']) {
    for (const direction of ['forward', 'backward', 'left', 'right']) {
      const clip = clips.find(({ id }) => id === `${action}_${direction}`);
      assert.ok(clip, `missing ${action}_${direction}`);
      assert.ok(clip.duration > 0);
      assert.ok(clip.tracks.length > 0);
      assert.ok(clip.tracks.every(({ keys }) => keys.every(({ t, rot }) => Number.isFinite(t) && rot.length === 3 && rot.every(Number.isFinite))));
    }
  }
  assert.equal(clips.find(({ id }) => id === 'esquive_rapido_left')?.loop, false);
  assert.notDeepEqual(clips.find(({ id }) => id === 'walk_forward')?.tracks, clips.find(({ id }) => id === 'walk_left')?.tracks);
});
