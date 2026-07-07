// Package port — Puertos hexagonales del game-server.
package port

// TerrainTypesFetcher obtiene terrain_types wire desde terrain-service (HTTP internal).
type TerrainTypesFetcher interface {
	FetchTypesViewport(bloqueID string, centerX, centerY, radius, zMin, zMax int) (wireJSON string, err error)
}
