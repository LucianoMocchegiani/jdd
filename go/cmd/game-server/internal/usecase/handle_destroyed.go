// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"math"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

type DestroyedEvent struct {
	BloqueID string
	ParticleID string
	X, Y, Z int
}

type SwingPlayerDamage struct {
	PlayerID string  `json:"player_id"`
	EntityID int     `json:"entity_id"`
	Damage   float64 `json:"damage"`
}

type SwingResultEvent struct {
	BloqueID string
	EcoID int
	PlayerID string
	EntityID int
	Seq int
	ActionID string
	TargetPlayerID string
	TargetEntityID int
	EntityDamage float64
	PlayerHits []SwingPlayerDamage
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
	sess, exists := s.Sessions.Get(ev.BloqueID, ev.EcoID)
	if !exists {
		return
	}
	attacker, exists := sess.GetPlayer(ev.PlayerID)
	if !exists || attacker.EntityID != uint32(ev.EntityID) {
		return
	}
	if ev.TargetPlayerID != "" && ev.TargetPlayerID != ev.PlayerID && ev.TargetEntityID > 0 && finitePositiveDamage(ev.EntityDamage) {
		applyPlayerDamage(sess, ev.TargetPlayerID, ev.TargetEntityID, ev.EntityDamage)
	}
	seen := make(map[string]struct{}, len(ev.PlayerHits))
	for _, hit := range ev.PlayerHits {
		if hit.PlayerID == "" || hit.PlayerID == ev.PlayerID || hit.EntityID <= 0 || !finitePositiveDamage(hit.Damage) {
			continue
		}
		if _, duplicate := seen[hit.PlayerID]; duplicate {
			continue
		}
		seen[hit.PlayerID] = struct{}{}
		applyPlayerDamage(sess, hit.PlayerID, hit.EntityID, hit.Damage)
	}
	s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
		if c.PlayerID == ev.PlayerID { wshub.SafeWrite(c, ev.RawJSON) }
	})
}

func finitePositiveDamage(damage float64) bool {
	return damage > 0 && !math.IsInf(damage, 0) && !math.IsNaN(damage)
}

func applyPlayerDamage(sess *entity.BlockSession, playerID string, entityID int, damage float64) {
	sess.UpdatePlayer(playerID, func(p *entity.Player) {
		if p.EntityID != uint32(entityID) || p.Health <= 0 { return }
		p.Health = math.Max(0, p.Health-damage)
	})
}

func buildParticleDestroyedWS(ev DestroyedEvent) string {
	b, _ := json.Marshal(map[string]interface{}{
		"type": "particle_destroyed", "particle_id": ev.ParticleID, "bloque_id": ev.BloqueID,
		"position": map[string]int{"x": ev.X, "y": ev.Y, "z": ev.Z},
	})
	return string(b)
}
