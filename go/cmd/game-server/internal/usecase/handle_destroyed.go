// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

type DestroyedEvent struct {
	BloqueID string
	ParticleID string
	X, Y, Z int
}

type SwingResultEvent struct {
	BloqueID string
	PlayerID string
	EntityID int
	Seq int
	ActionID string
	TargetPlayerID string
	TargetEntityID int
	EntityDamage float64
	RawJSON string
}

func (s *Services) HandleParticleDestroyed(ev DestroyedEvent) {
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) {
		sess.SolidGrid.RemoveCell(ev.X, ev.Y, ev.Z)
	}
	wire := buildParticleDestroyedWS(ev)
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) {
		s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) { wshub.SafeWrite(c, wire) })
	}
}

func (s *Services) HandleSwingResult(ev SwingResultEvent) {
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) {
		if _, exists := sess.GetPlayer(ev.PlayerID); !exists {
			continue
		}
		if ev.TargetPlayerID != "" && ev.EntityDamage > 0 {
			sess.UpdatePlayer(ev.TargetPlayerID, func(p *entity.Player) {
				p.Health -= ev.EntityDamage
				if p.Health < 0 {
					p.Health = 0
				}
			})
		}
		s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
			if c.PlayerID == ev.PlayerID {
				wshub.SafeWrite(c, ev.RawJSON)
			}
		})
	}
}

func buildParticleDestroyedWS(ev DestroyedEvent) string {
	b, _ := json.Marshal(map[string]interface{}{
		"type": "particle_destroyed", "particle_id": ev.ParticleID, "bloque_id": ev.BloqueID,
		"position": map[string]int{"x": ev.X, "y": ev.Y, "z": ev.Z},
	})
	return string(b)
}
