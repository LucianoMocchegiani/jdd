/**
 * Los centros de las partículas horizontales usan coordenadas enteras; los empates corresponden a la celda de índice mayor.
 * Z se excluye intencionalmente porque la coordenada Z del jugador representa la altura de los pies.
 */
export function particleColumnIndex(coordinate: number): number {
  return Math.floor(coordinate + 0.5);
}
