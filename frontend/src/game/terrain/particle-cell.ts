/**
 * Horizontal particle centers are integer world coordinates; ties belong to the higher cell.
 */
export function particleColumnIndex(coordinate: number): number {
  return Math.floor(coordinate + 0.5);
}
