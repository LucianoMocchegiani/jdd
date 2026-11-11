/**
 * Horizontal particle centers use integer world coordinates; ties belong to the higher cell.
 * Z is intentionally excluded because player Z represents feet height.
 */
export function particleColumnIndex(coordinate: number): number {
  return Math.floor(coordinate + 0.5);
}
