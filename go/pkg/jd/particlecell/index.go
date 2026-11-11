// Package particlecell convierte coordenadas horizontales del mundo en columnas de partículas centradas en enteros.
package particlecell

import "math"

// ColumnIndex devuelve la columna de partículas cuyo centro entero está más cerca de coordinate.
// Los empates en media celda corresponden a la columna de índice mayor.
func ColumnIndex(coordinate float64) int {
	return int(math.Floor(coordinate + 0.5))
}
