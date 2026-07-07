/**
 * @file Medio de locomoción (`medium`) — un valor exclusivo por entidad.
 *
 * Describe **inmersión / soporte** (suelo, aire, cuánto del cuerpo está en fluido).
 * El material concreto (agua, lodo, arena) va en {@link ContactContext.dominantTipoNombre}.
 */

/** Ids canónicos de `medium` (catálogo en `medium-registry.ts`). */
export const MEDIUM_IDS = [
  'ground',
  'air',
  'submerged_partial',
  'submerged_full',
] as const;

/**
 * Identificador de medio válido para `when.medium` y {@link ContactComponent}.
 */
export type Medium = (typeof MEDIUM_IDS)[number];

/**
 * Comprueba si un string es un {@link Medium} conocido.
 */
export function isMediumId(value: string): value is Medium {
  return (MEDIUM_IDS as readonly string[]).includes(value);
}
