// Package rediskeys — Constantes de keys y streams Redis del monorepo.
package rediskeys

import "fmt"

const (
	StreamTerrainRequests  = "terrain:requests"
	StreamTerrainReady     = "terrain:ready"
	StreamTerrainInvalidate = "terrain:invalidate"
	StreamSwingCommands    = "swing:commands"
	StreamGameDestroyed    = "game:destroyed"
	StreamSwingResults   = "game:swing_results"
	StreamBlockSeeded      = "world:block_seeded"
)

// ChunkWireKey ejecuta chunk wire key.
func ChunkWireKey(bloqueID string, cx, cy int) string {
	return fmt.Sprintf("chunk:wire:%s:%d,%d", bloqueID, cx, cy)
}

// ChunkSolidKey ejecuta chunk solid key.
func ChunkSolidKey(bloqueID string, cx, cy int) string {
	return fmt.Sprintf("chunk:solid:%s:%d,%d", bloqueID, cx, cy)
}

// ChunkVerKey ejecuta chunk ver key.
func ChunkVerKey(bloqueID string, cx, cy int) string {
	return fmt.Sprintf("chunk:ver:%s:%d,%d", bloqueID, cx, cy)
}

// ChunkPendingKey ejecuta chunk pending key.
func ChunkPendingKey(bloqueID string, cx, cy int) string {
	return fmt.Sprintf("chunk:pending:%s:%d,%d", bloqueID, cx, cy)
}

// BlockVerKey ejecuta block ver key.
func BlockVerKey(bloqueID string) string {
	return fmt.Sprintf("block:ver:%s", bloqueID)
}

// RateLimitDestroyKey ejecuta rate limit destroy key.
func RateLimitDestroyKey(bloqueID string) string {
	return fmt.Sprintf("ratelimit:destroy:%s", bloqueID)
}

// RegistryEcoKey ejecuta registry eco key.
func RegistryEcoKey(bloqueID string, ecoID int) string {
	return fmt.Sprintf("registry:eco:%s:%d", bloqueID, ecoID)
}

// RegistryPlayerKey ejecuta registry player key.
func RegistryPlayerKey(playerID string) string {
	return fmt.Sprintf("registry:player:%s", playerID)
}

// RegistryGameKey ejecuta registry game key.
func RegistryGameKey(instanceID string) string {
	return fmt.Sprintf("registry:game:%s", instanceID)
}

// RegistryEcoMembersKey ejecuta registry eco members key.
func RegistryEcoMembersKey(bloqueID string, ecoID int) string {
	return fmt.Sprintf("registry:eco:%s:%d:members", bloqueID, ecoID)
}

// RegistryBloqueNextEcoKey ejecuta registry bloque next eco key.
func RegistryBloqueNextEcoKey(bloqueID string) string {
	return fmt.Sprintf("registry:bloque:%s:next_eco", bloqueID)
}

// RegistryBloqueEcosKey ejecuta registry bloque ecos key.
func RegistryBloqueEcosKey(bloqueID string) string {
	return fmt.Sprintf("registry:bloque:%s:ecos", bloqueID)
}

// EcoKey ejecuta eco key.
func EcoKey(bloqueID string, ecoID int) string {
	return fmt.Sprintf("%s:%d", bloqueID, ecoID)
}
