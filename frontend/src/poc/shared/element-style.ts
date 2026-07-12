/**
 * Formas y paleta de render para elementos del Character Studio.
 */

export type ElementShape = 'box' | 'sphere' | 'cylinder' | 'cone';

/** Colores por capa de elemento + gizmo de hueso en el editor. */
export interface LayerPalette {
  core: number;
  flesh: number;
  /** Vestimenta, armadura, equipo. */
  gear: number;
  accent: number;
  /** Esferas debug de pivotes (solo modo editor). */
  bone: number;
}

export const DEFAULT_PALETTE: LayerPalette = {
  core: 0x3a2820,
  flesh: 0xd4a882,
  gear: 0x6b4a32,
  accent: 0xe87830,
  bone: 0x9aa0a8,
};
