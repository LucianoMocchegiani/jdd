import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const ids = ['walk_forward', 'walk_backward', 'walk_left', 'walk_right', 'run_forward', 'run_backward', 'run_left', 'run_right', 'esquive_rapido_forward', 'esquive_rapido_backward', 'esquive_rapido_left', 'esquive_rapido_right'];
const clips = ids.map((id) => JSON.parse(readFileSync(new URL(`./animations/${id}.json`, import.meta.url), 'utf8')) as {
  id: string; duration: number; loop: boolean; tracks: Array<{ boneId: string; keys: Array<{ t: number; rot: number[] }> }>;
});

test('directional animation files contain valid walk, run, and dodge clips', () => {
  assert.equal(clips.length, 12);
  for (const clip of clips) {
    assert.ok(ids.includes(clip.id));
    assert.ok(clip.duration > 0);
    assert.ok(clip.tracks.length > 0);
    assert.ok(clip.tracks.every(({ keys }) => keys.every(({ t, rot }) => Number.isFinite(t) && rot.length === 3 && rot.every(Number.isFinite))));
  }
  assert.ok(clips.filter(({ id }) => id.startsWith('esquive_rapido_')).every(({ loop }) => !loop));
  assert.notDeepEqual(clips.find(({ id }) => id === 'walk_forward')?.tracks, clips.find(({ id }) => id === 'walk_left')?.tracks);
});
