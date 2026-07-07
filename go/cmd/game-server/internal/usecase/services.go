// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

// Services representa services.
type Services struct {
	Sessions     port.SessionStore
	TerrainPub   port.TerrainPublisher
	TerrainTypes port.TerrainTypesFetcher
	SwingPub     port.SwingPublisher
	Registry     port.RegistryClient
	Hub          *wshub.Hub
	SessionCfg   *session.Config
	InstanceID   string
	ServerWire   string
	TerrainPush  *TerrainPushManager
}
