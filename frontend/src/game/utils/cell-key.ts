/**
 * @file Claves de celda para sets de colisión / ocupación.
 */

/**
 * Clave única de celda en el mundo (coordenadas de grilla).
 */
export function cellKey(x: number, y: number, z: number): string {
  return `${x},${y},${z}`;
}

/**
 * Parsea una clave producida por {@link cellKey}.
 */
export function parseCellKey(key: string): { x: number; y: number; z: number } {
  const [xs, ys, zs] = key.split(',');
  return {
    x: Number(xs ?? 0),
    y: Number(ys ?? 0),
    z: Number(zs ?? 0),
  };
}
