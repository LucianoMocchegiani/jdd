// Package particlecell maps horizontal world coordinates to integer-centered particle columns.
package particlecell

import "math"

// ColumnIndex returns the particle column whose integer center is nearest to coordinate.
// Half-cell ties belong to the higher-indexed column.
func ColumnIndex(coordinate float64) int {
	return int(math.Floor(coordinate + 0.5))
}
