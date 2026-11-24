// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"math"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

type DestroyedEvent struct {
	BloqueID string
	ParticleID string
	X, Y, Z int
}
type SwingPlayerDamage struct { PlayerID string `json:"player_id"`; EntityID int `json:"entity_id"`; Damage float64 `json:"damage"` }
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
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) { sess.SolidGrid.RemoveCell(ev.X, ev.Y, ev.Z) }
	wire := buildParticleDestroyedWS(ev)
	for _, sess := range s.Sessions.GetByBloque(ev.BloqueID) { s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) { wshub.SafeWrite(c, wire) }) }
}

func (s *Services) HandleSwingResult(ev SwingResultEvent) {
	sess, exists := s.Sessions.Get(ev.BloqueID, ev.EcoID)
	if !exists || !validEntityID(ev.EntityID) { return }
	attacker, exists := sess.GetPlayer(ev.PlayerID)
	if !exists || attacker.EntityID != uint32(ev.EntityID) { return }
	seen := make(map[string]struct{}, len(ev.PlayerHits)+1)
	if ev.TargetPlayerID != "" && ev.TargetPlayerID != ev.PlayerID && validEntityID(ev.TargetEntityID) && finitePositiveDamage(ev.EntityDamage) {
		applyPlayerDamage(sess, ev.PlayerID, ev.TargetPlayerID, ev.TargetEntityID, ev.EntityDamage)
		seen[ev.TargetPlayerID] = struct{}{}
	}
	for _, hit := range ev.PlayerHits {
		if hit.PlayerID == "" || hit.PlayerID == ev.PlayerID || !validEntityID(hit.EntityID) || !finitePositiveDamage(hit.Damage) { continue }
		if _, duplicate := seen[hit.PlayerID]; duplicate { continue }
		seen[hit.PlayerID] = struct{}{}
		applyPlayerDamage(sess, ev.PlayerID, hit.PlayerID, hit.EntityID, hit.Damage)
	}
	s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) { if c.PlayerID == ev.PlayerID { wshub.SafeWrite(c, ev.RawJSON) } })
}
func validEntityID(id int) bool { return id > 0 && uint64(id) <= uint64(^uint32(0)) }
func finitePositiveDamage(damage float64) bool { return damage > 0 && !math.IsInf(damage, 0) && !math.IsNaN(damage) }
func applyPlayerDamage(sess *entity.BlockSession, sourceID, playerID string, entityID int, damage float64) {
	sess.ApplyPlayerDamageFrom(sourceID, playerID, entityID, damage, time.Now())
}
func buildParticleDestroyedWS(ev DestroyedEvent) string {
	b, _ := json.Marshal(map[string]interface{}{"type":"particle_destroyed","particle_id":ev.ParticleID,"bloque_id":ev.BloqueID,"position":map[string]int{"x":ev.X,"y":ev.Y,"z":ev.Z}})
	return string(b)
}
