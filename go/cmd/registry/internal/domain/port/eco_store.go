// Package port — Puerto EcoStore (Redis).
package port

import (
	"context"

	"github.com/juego-de-dioses/jd/cmd/registry/internal/domain"
)

// EcoStore representa eco store.
type EcoStore interface {
	RegisterGame(ctx context.Context, instanceID, wsURL string) error
	TouchGame(ctx context.Context, instanceID string) error
	ListGames(ctx context.Context) ([]domain.GameInstance, error)

	AssignPlayer(ctx context.Context, bloqueID, playerID string, maxPlayers int) (*domain.Assignment, error)
	ReleasePlayer(ctx context.Context, bloqueID, playerID string, ecoID int) error
	SyncPlayerEco(ctx context.Context, bloqueID, playerID string, targetEcoID int, maxPlayers int) (*domain.Assignment, error)
}
