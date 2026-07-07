// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

// DestroyedEvent representa destroyed event.
type DestroyedEvent struct {
	BloqueID   string
	ParticleID string
	X, Y, Z    int
}

// SwingResultEvent representa swing result event.
type SwingResultEvent struct {
	BloqueID string
	EntityID int
	Seq      int
	ActionID string
	RawJSON  string
}

// HandleParticleDestroyed implementa handle particle destroyed.
func (s *Services) HandleParticleDestroyed(ev DestroyedEvent) {
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) {
		sess.SolidGrid.RemoveCell(ev.X, ev.Y, ev.Z)
	}
	wire := buildParticleDestroyedWS(ev)
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) {
		s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
			wshub.SafeWrite(c, wire)
		})
	}
}

// HandleSwingResult implementa handle swing result.
func (s *Services) HandleSwingResult(ev SwingResultEvent) {
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) {
		var targetPlayerID string
		sess.ForEachPlayer(func(p *entity.Player) {
			if p.EntityID == uint32(ev.EntityID) {
				targetPlayerID = p.ID
			}
		})
		if targetPlayerID == "" {
			continue
		}
		s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
			if c.PlayerID == targetPlayerID {
				wshub.SafeWrite(c, ev.RawJSON)
			}
		})
	}
}

func buildParticleDestroyedWS(ev DestroyedEvent) string {
	b, _ := json.Marshal(map[string]interface{}{
		"type":        "particle_destroyed",
		"particle_id": ev.ParticleID,
		"bloque_id":   ev.BloqueID,
		"position":    map[string]int{"x": ev.X, "y": ev.Y, "z": ev.Z},
	})
	return string(b)
}
