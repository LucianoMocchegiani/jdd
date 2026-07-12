/**
 * Tipos del documento v2 de Character Studio (huesos + elementos, estilo Blockbench).
 *
 * Convención espacial: {@link Vec3} = `[dx, dz, dy]` mapeado a ejes Three `[x, y, z]`.
 *
 * @module character-studio/types
 */

import type { ElementShape } from '@/poc/shared';

/** Modo de la app unificada: diseño del rig o preview/animación. */
export type StudioMode = 'edit' | 'animate';

/** Capa visual de un cubo/cilindro rígido colgado de un hueso. */
export type ElementLayer = 'core' | 'flesh' | 'gear' | 'accent';

/** Eje de rotación principal del hueso. */
export type BoneAxis = 'x' | 'y' | 'z';

/** Rol anatómico del hueso (metadata del rig). */
export type BoneRole = 'root' | 'neck' | 'hip' | 'knee' | 'shoulder' | 'elbow';

/**
 * Vector 3D en espacio Three.
 * Convención del documento: `[dx, dz, dy]`.
 */
export type Vec3 = [number, number, number];

/** Interpolación entre keyframes. */
export type AnimInterp = 'linear' | 'step';

/** Hueso del esqueleto — solo los huesos se animan; los elementos cuelgan de ellos. */
export interface StudioBone {
  id: string;
  parentId: string | null;
  pivot: Vec3;
  /** Rotación bind Euler XYZ (radianes). */
  rot?: Vec3;
  axis: BoneAxis;
  role: BoneRole;
}

export interface StudioElement {
  id: string;
  boneId: string;
  shape: ElementShape;
  layer: ElementLayer;
  pos: Vec3;
  scale: Vec3;
  rot: Vec3;
  isCore?: boolean;
}

export interface StudioDocument {
  version: 2;
  label: string;
  gridStep: number;
  bones: StudioBone[];
  elements: StudioElement[];
}

/** Keyframe v2 — rotación Euler absoluta local del hueso. */
export interface AnimKeyframe {
  t: number;
  rot: Vec3;
  interp?: AnimInterp;
}

export interface AnimTrack {
  boneId: string;
  keys: AnimKeyframe[];
}

/**
 * Clip de animación v2 — keyframes euler por hueso.
 * Export JDD: un archivo por clip (`walk.json`, etc.).
 */
export interface StudioAnimationClip {
  version: 2;
  id: string;
  label: string;
  duration: number;
  loop: boolean;
  /** Frames por segundo para snap en el editor. */
  fps: number;
  tracks: AnimTrack[];
}

/** Librería de clips del personaje activo. */
export interface StudioClipLibrary {
  clips: StudioAnimationClip[];
  activeId: string;
}

export interface BuiltRig {
  boneBindWorld: Map<string, import('three').Matrix4>;
  boneLocalBind: Map<string, import('three').Matrix4>;
  elementLocal: Map<string, import('three').Matrix4>;
  boneById: Map<string, StudioBone>;
  elementById: Map<string, StudioElement>;
  rootBoneId: string;
}

/** FPS permitidos en el editor. */
export type StudioFps = 24 | 30 | 60;

export const DEFAULT_CLIP_DURATION = 0.3;

export type PresetClipId = 'idle' | 'walk' | 'attack' | 'swim' | 'death';
