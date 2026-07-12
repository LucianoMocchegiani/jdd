/**
 * Clips de animación v2 — keyframes Euler absolutos por hueso.
 *
 * @module character-studio/studio-clip
 */

import type {
  AnimInterp,
  AnimKeyframe,
  PresetClipId,
  StudioAnimationClip,
  StudioBone,
  StudioClipLibrary,
  StudioFps,
  Vec3,
} from '@/poc/character-studio/types';
import { DEFAULT_CLIP_DURATION } from '@/poc/character-studio/types';
import walkClipRaw from '@/poc/walk.md?raw';

/** Rotación bind de un hueso (radianes XYZ). */
function bindRotForBone(bone: StudioBone): Vec3 {
  return bone.rot ? [...bone.rot] : [0, 0, 0];
}

/** Clip walk por defecto — `src/poc/walk.md`. */
function defaultWalkClip(): StudioAnimationClip {
  return clipFromJson(walkClipRaw);
}

/** Librería con presets idle/walk/attack/swim/death (0.3 s cada uno). */
export function createDefaultClipLibrary(bones: StudioBone[], fps: StudioFps = 30): StudioClipLibrary {
  const clips: StudioAnimationClip[] = [
    createBindClip('idle', 'idle', bones, fps),
    defaultWalkClip(),
    createBindClip('attack', 'attack', bones, fps),
    createBindClip('swim', 'swim', bones, fps),
    createBindClip('death', 'death', bones, fps),
  ];
  return { clips, activeId: 'idle' };
}

/** Clip bind en t=0 para cada hueso. */
export function createBindClip(
  id: PresetClipId,
  label: string,
  bones: StudioBone[],
  fps: StudioFps,
  duration = DEFAULT_CLIP_DURATION,
  loop = true,
): StudioAnimationClip {
  const clip: StudioAnimationClip = {
    version: 2,
    id,
    label,
    duration,
    loop,
    fps,
    tracks: [],
  };
  for (const bone of bones) {
    setKeyframe(clip, bone.id, 0, bindRotForBone(bone), 'linear');
  }
  return clip;
}

/** Deja solo keyframe bind en t=0 (conserva metadatos del clip). */
export function clearClipToBind(clip: StudioAnimationClip, bones: StudioBone[]): void {
  clip.tracks = [];
  for (const bone of bones) {
    setKeyframe(clip, bone.id, 0, bindRotForBone(bone), 'linear', clip.fps);
  }
}

/** Tolerancia de coincidencia de keyframe (medio frame). */
function keyframeEpsilon(fps: number): number {
  return 0.5 / fps;
}

/**
 * Inserta o actualiza un keyframe en una pista del clip.
 * Si ya hay uno dentro de medio frame, lo reemplaza.
 */
export function setKeyframe(
  clip: StudioAnimationClip,
  boneId: string,
  t: number,
  rot: Vec3,
  interp: AnimInterp = 'linear',
  fps: number = clip.fps,
): void {
  let tr = clip.tracks.find((x) => x.boneId === boneId);
  if (!tr) {
    tr = { boneId, keys: [] };
    clip.tracks.push(tr);
  }
  const eps = keyframeEpsilon(fps);
  const idx = tr.keys.findIndex((k) => Math.abs(k.t - t) < eps);
  const key: AnimKeyframe = { t, rot: [...rot], interp };
  if (idx >= 0) {
    tr.keys[idx] = key;
  } else {
    tr.keys.push(key);
    tr.keys.sort((a, b) => a.t - b.t);
  }
}

/** Elimina keyframe más cercano al tiempo dado. */
export function removeKeyframe(
  clip: StudioAnimationClip,
  boneId: string,
  t: number,
  fps: number = clip.fps,
): void {
  const tr = clip.tracks.find((x) => x.boneId === boneId);
  if (!tr) return;
  const eps = keyframeEpsilon(fps);
  const idx = tr.keys.findIndex((k) => Math.abs(k.t - t) < eps);
  if (idx >= 0) tr.keys.splice(idx, 1);
}

/** ¿Hay keyframe en este tiempo (tolerancia medio frame)? */
export function hasKeyframeAt(
  clip: StudioAnimationClip,
  boneId: string,
  t: number,
  fps: number = clip.fps,
): boolean {
  const tr = clip.tracks.find((x) => x.boneId === boneId);
  if (!tr) return false;
  const eps = keyframeEpsilon(fps);
  return tr.keys.some((k) => Math.abs(k.t - t) < eps);
}

/**
 * Muestrea el clip en un instante → mapa `boneId → rot` euler.
 */
export function sampleClip(
  clip: StudioAnimationClip,
  time: number,
  bones: StudioBone[],
): Map<string, Vec3> {
  const looped = clip.loop && clip.duration > 0 ? time % clip.duration : Math.min(time, clip.duration);
  const out = new Map<string, Vec3>();
  for (const bone of bones) {
    const tr = clip.tracks.find((x) => x.boneId === bone.id);
    const raw = sampleTrack(tr?.keys ?? [], looped, bindRotForBone(bone));
    out.set(bone.id, raw);
  }
  return out;
}

function lerpVec3(a: Vec3, b: Vec3, u: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

function sampleTrack(keys: AnimKeyframe[], time: number, fallback: Vec3): Vec3 {
  if (keys.length === 0) return [...fallback];
  if (time <= keys[0]!.t) return [...keys[0]!.rot];
  if (time >= keys[keys.length - 1]!.t) return [...keys[keys.length - 1]!.rot];

  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (time >= a.t && time <= b.t) {
      if (b.interp === 'step' || a.interp === 'step') return [...a.rot];
      const u = (time - a.t) / (b.t - a.t);
      return lerpVec3(a.rot, b.rot, u);
    }
  }
  return [...fallback];
}

/** Snap de tiempo al frame más cercano según FPS del clip. */
export function snapTime(t: number, fps: number): number {
  const frame = Math.round(t * fps);
  return frame / fps;
}

/** Serializa un clip a JSON legible. */
export function clipToJson(clip: StudioAnimationClip): string {
  return JSON.stringify(clip, null, 2);
}

function isVec3(v: unknown): v is Vec3 {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function normalizeClip(raw: unknown): StudioAnimationClip {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Clip inválido: se esperaba un objeto');
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 2) {
    throw new Error(`Clip versión ${String(o.version)} no soportada (se requiere v2)`);
  }
  if (typeof o.id !== 'string' || !o.id.trim()) {
    throw new Error('Clip inválido: falta id');
  }
  if (typeof o.duration !== 'number' || o.duration < 0) {
    throw new Error('Clip inválido: duration debe ser un número ≥ 0');
  }
  if (!Array.isArray(o.tracks)) {
    throw new Error('Clip inválido: tracks debe ser un array');
  }

  const fps = o.fps === 24 || o.fps === 30 || o.fps === 60 ? o.fps : 30;
  const tracks = o.tracks.map((tr, i) => {
    if (typeof tr !== 'object' || tr === null) throw new Error(`Track ${i}: inválido`);
    const t = tr as Record<string, unknown>;
    if (typeof t.boneId !== 'string') throw new Error(`Track ${i}: falta boneId`);
    if (!Array.isArray(t.keys)) throw new Error(`Track ${t.boneId}: keys debe ser un array`);

    const keys = t.keys.map((k, j) => {
      if (typeof k !== 'object' || k === null) throw new Error(`Keyframe ${t.boneId}[${j}]: inválido`);
      const key = k as Record<string, unknown>;
      if (typeof key.t !== 'number') throw new Error(`Keyframe ${t.boneId}[${j}]: falta t`);
      if (!isVec3(key.rot)) throw new Error(`Keyframe ${t.boneId}[${j}]: rot debe ser [rx,ry,rz]`);
      const interp: AnimInterp = key.interp === 'step' ? 'step' : 'linear';
      return { t: key.t, rot: [...key.rot] as Vec3, interp };
    });

    keys.sort((a, b) => a.t - b.t);
    return { boneId: t.boneId, keys };
  });

  return {
    version: 2,
    id: o.id,
    label: typeof o.label === 'string' ? o.label : o.id,
    duration: o.duration,
    loop: o.loop !== false,
    fps,
    tracks,
  };
}

/**
 * Parsea JSON de clip — acepta export JDD (`{ type, clip }`) o clip v2 directo.
 */
export function clipFromJson(json: string): StudioAnimationClip {
  const trimmed = json.trim();
  if (!trimmed) throw new Error('JSON vacío');
  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    throw new Error('JSON mal formado');
  }
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (o.type === 'character-clip' && o.clip) return normalizeClip(o.clip);
  }
  return normalizeClip(raw);
}

/** Clip activo de la librería. */
export function getActiveClip(library: StudioClipLibrary): StudioAnimationClip {
  return library.clips.find((c) => c.id === library.activeId) ?? library.clips[0]!;
}

/** Reemplaza o añade un clip en la librería. */
export function upsertClip(library: StudioClipLibrary, clip: StudioAnimationClip): void {
  const idx = library.clips.findIndex((c) => c.id === clip.id);
  if (idx >= 0) library.clips[idx] = clip;
  else library.clips.push(clip);
}
