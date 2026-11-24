import type { StudioAnimationClip } from '@/poc/character-studio/types';

type Direction = 'forward' | 'backward' | 'left' | 'right';
const DIRECTIONS: readonly Direction[] = ['forward', 'backward', 'left', 'right'];
const LIMB_BONES = /^(cadera|hombro|rodilla|codo)-/;

function variant(base: StudioAnimationClip, id: string, label: string, direction: Direction, run = false): StudioAnimationClip {
  const duration = base.duration * (run ? 0.65 : 1);
  return {
    ...base,
    id,
    label,
    duration,
    tracks: base.tracks.map((track) => {
      const lateral = direction === 'left' || direction === 'right';
      const sign = direction === 'left' ? -1 : 1;
      const keys = track.keys.map((key) => {
        const rot = [...key.rot] as [number, number, number];
        if (run && LIMB_BONES.test(track.boneId)) {
          rot[0] *= 1.25;
          rot[1] *= 1.25;
          rot[2] *= 1.25;
        }
        if (lateral && LIMB_BONES.test(track.boneId)) {
          rot[0] = rot[2] * sign;
          rot[2] = 0;
        }
        if (direction === 'backward' && track.boneId === 'controller') rot[0] *= -1;
        if (lateral && track.boneId === 'controller') {
          rot[2] += rot[0] * sign;
          rot[0] = 0;
        }
        return {
          ...key,
          t: direction === 'backward' ? duration - key.t * duration / base.duration : key.t * duration / base.duration,
          rot,
        };
      }).sort((a, b) => a.t - b.t);
      return { ...track, keys };
    }),
  };
}

/** Builds runtime directional clips from the authored walk and dodge poses. */
export function createDirectionalPlayerClips(walk: StudioAnimationClip, dodge: StudioAnimationClip): StudioAnimationClip[] {
  return DIRECTIONS.flatMap((direction) => [
    variant(walk, `walk_${direction}`, `Caminar ${direction}`, direction),
    variant(walk, `run_${direction}`, `Correr ${direction}`, direction, true),
    variant(dodge, `esquive_rapido_${direction}`, `Esquive ${direction}`, direction),
  ]);
}
