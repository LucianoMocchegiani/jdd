// Package chunkcoords — Coordenadas de chunk (floor division, keys, radio).
package chunkcoords

import (
	"fmt"
	"math"
)

// CoordFromCell returns chunk index for a cell coordinate (floor division, negative-safe).
func CoordFromCell(cell, chunkSize int) int {
	if cell >= 0 {
		return cell / chunkSize
	}
	return (cell - chunkSize + 1) / chunkSize
}

// Key returns stable "cx,cy" string.
func Key(cx, cy int) string {
	return fmt.Sprintf("%d,%d", cx, cy)
}

// KeyFromCell returns chunk key containing cell (x, y).
func KeyFromCell(x, y, chunkSize int) string {
	return Key(CoordFromCell(x, chunkSize), CoordFromCell(y, chunkSize))
}

// CellBounds returns inclusive (xMin, xMax, yMin, yMax) for chunk tile.
func CellBounds(cx, cy, chunkSize int) (xMin, xMax, yMin, yMax int) {
	xMin = cx * chunkSize
	yMin = cy * chunkSize
	return xMin, xMin + chunkSize - 1, yMin, yMin + chunkSize - 1
}

// KeysInRadius returns chunk keys intersecting a disc (conservative bbox).
func KeysInRadius(centerX, centerY float64, radiusCells, chunkSize int) map[string]struct{} {
	cx := int(math.Floor(centerX))
	cy := int(math.Floor(centerY))
	minX, maxX := cx-radiusCells, cx+radiusCells
	minY, maxY := cy-radiusCells, cy+radiusCells
	cx0 := CoordFromCell(minX, chunkSize)
	cx1 := CoordFromCell(maxX, chunkSize)
	cy0 := CoordFromCell(minY, chunkSize)
	cy1 := CoordFromCell(maxY, chunkSize)
	out := make(map[string]struct{})
	for i := cx0; i <= cx1; i++ {
		for j := cy0; j <= cy1; j++ {
			out[Key(i, j)] = struct{}{}
		}
	}
	return out
}

// UnionForPlayers merges chunk windows for all player positions.
func UnionForPlayers(positions [][2]float64, radiusCells, chunkSize int) map[string]struct{} {
	out := make(map[string]struct{})
	for _, p := range positions {
		for k := range KeysInRadius(p[0], p[1], radiusCells, chunkSize) {
			out[k] = struct{}{}
		}
	}
	return out
}
