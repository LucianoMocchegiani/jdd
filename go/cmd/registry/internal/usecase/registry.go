// Package usecase orquesta registro, heartbeat y resolución de jugadores vía registry.

package usecase

import (
	"context"

	"github.com/juego-de-dioses/jd/cmd/registry/internal/domain"
	"github.com/juego-de-dioses/jd/cmd/registry/internal/domain/port"
)

// RegisterGameServer registra instancias game-server y mantiene su TTL en Redis.
type RegisterGameServer struct {
	store port.EcoStore
}

// NewRegisterGameServer construye register game server.
func NewRegisterGameServer(store port.EcoStore) *RegisterGameServer {
	return &RegisterGameServer{store: store}
}

// Register implementa register.
func (uc *RegisterGameServer) Register(ctx context.Context, instanceID, wsURL string) error {
	if err := uc.store.RegisterGame(ctx, instanceID, wsURL); err != nil {
		return err
	}
	return uc.store.TouchGame(ctx, instanceID)
}

// Heartbeat implementa heartbeat.
func (uc *RegisterGameServer) Heartbeat(ctx context.Context, instanceID string) error {
	return uc.store.TouchGame(ctx, instanceID)
}

// ResolvePlayer asigna un jugador a un eco/shard según capacidad del bloque.
type ResolvePlayer struct {
	store          port.EcoStore
	maxPlayersPerEco int
}

// NewResolvePlayer construye resolve player.
func NewResolvePlayer(store port.EcoStore, maxPlayersPerEco int) *ResolvePlayer {
	return &ResolvePlayer{store: store, maxPlayersPerEco: maxPlayersPerEco}
}

// Resolve implementa resolve.
func (uc *ResolvePlayer) Resolve(ctx context.Context, bloqueID, playerID string) (*domain.Assignment, error) {
	return uc.store.AssignPlayer(ctx, bloqueID, playerID, uc.maxPlayersPerEco)
}

// ReleasePlayer libera la asignación de un jugador al desconectar.
type ReleasePlayer struct {
	store port.EcoStore
}

// NewReleasePlayer construye release player.
func NewReleasePlayer(store port.EcoStore) *ReleasePlayer {
	return &ReleasePlayer{store: store}
}

// Release implementa release.
func (uc *ReleasePlayer) Release(ctx context.Context, bloqueID, playerID string, ecoID int) error {
	return uc.store.ReleasePlayer(ctx, bloqueID, playerID, ecoID)
}

// SyncEco mueve un jugador a otro eco dentro del mismo bloque (guerra v3 / dimensiones).
type SyncEco struct {
	store            port.EcoStore
	maxPlayersPerEco int
}

// NewSyncEco construye sync eco.
func NewSyncEco(store port.EcoStore, maxPlayersPerEco int) *SyncEco {
	return &SyncEco{store: store, maxPlayersPerEco: maxPlayersPerEco}
}

// Sync implementa sync.
func (uc *SyncEco) Sync(ctx context.Context, bloqueID, playerID string, targetEcoID int) (*domain.Assignment, error) {
	return uc.store.SyncPlayerEco(ctx, bloqueID, playerID, targetEcoID, uc.maxPlayersPerEco)
}
