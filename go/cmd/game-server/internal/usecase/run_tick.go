// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/sim/systems"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
)

const (
	tickHz = 30
	maxDeltaSec = 0.1
)

func (s *Services) RunTick(deltaSec float64) {
	if deltaSec <= 0 {
		deltaSec = 1.0 / tickHz
	}
	if deltaSec > maxDeltaSec {
		deltaSec = maxDeltaSec
	}
	for _, sess := range s.Sessions.AllSessions() {
		if sess.PlayerCount() == 0 {
			continue
		}
		s.MaybeRefreshTerrain(sess)
		now := time.Now()
		sess.ForEachPlayer(func(p *entity.Player) {
			p.RegenerateMana(deltaSec, now)
			systems.RunPlayerTick(p, sess.SolidGrid, s.SessionCfg, s.Medium, deltaSec)
		})
		projectiles := sess.AdvanceProjectiles(deltaSec)
		for _, projectile := range projectiles {
			if projectile.ParticleID != "" && s.SwingPub != nil {
				err := s.SwingPub.PublishSwing(port.SwingCommand{
					BloqueID: sess.BloqueID, EcoID: sess.EcoID, PlayerID: projectile.OwnerID,
					ActionID: projectile.ActionID, EntityID: int(projectile.EntityID), Seq: projectile.Seq,
					ParticleID: projectile.ParticleID, ParticleX: projectile.ParticleX,
					ParticleY: projectile.ParticleY, ParticleZ: projectile.ParticleZ,
				})
				if err == nil {
					sess.AcknowledgeProjectileParticleHit(projectile.ID)
				}
			}
			if s.Hub != nil {
				payload, _ := json.Marshal(projectile)
				s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
					wshub.SafeWrite(c, string(payload))
				})
			}
		}
		tick := sess.IncrementTick()
		states := buildPlayerStates(sess, tick, true)
		if s.Hub != nil {
			s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
				for _, msg := range states {
					wshub.WritePlayerState(c, msg)
				}
			})
		}
	}
	s.DrainTerrainFanout()
}

func BuildAllPlayerStates(sess *entity.BlockSession, tick int) []string {
	return buildPlayerStates(sess, tick, false)
}

func buildPlayerStates(sess *entity.BlockSession, tick int, publishActions bool) []string {
	var out []string
	now := time.Now()
	sess.ForEachPlayer(func(p *entity.Player) {
		payload := map[string]interface{}{
			"type": "player_state", "server_tick": tick, "player_id": p.ID, "bloque_id": sess.BloqueID,
			"x": p.X, "y": p.Y, "z": p.Z, "vx": p.VX, "vy": p.VY, "vz": p.VZ,
			"yaw": p.Yaw, "medium": p.Medium, "input_seq": p.InputSeq,
			"intents": intentsTrueOnly(p.Intents), "health": p.Health, "max_health": p.MaxHealth,
			"mana": p.Mana, "max_mana": p.MaxMana, "in_combat": p.InCombat(now),
		}
		if p.Pitch != 0 {
			payload["pitch"] = p.Pitch
		}
		if publishActions && p.ActionID != "" {
			payload["action_id"] = p.ActionID
			payload["action_seq"] = p.ActionSeq
			p.ActionID = ""
		}
		b, _ := json.Marshal(payload)
		out = append(out, string(b))
	})
	return out
}

func intentsTrueOnly(m map[string]bool) map[string]bool {
	out := make(map[string]bool)
	for k, v := range m {
		if v {
			out[k] = true
		}
	}
	return out
}

func BuildJoinOK(bloqueID string, ecoID int, ecoLabel, playerID, wireFormat string, players []string) string {
	payload := map[string]interface{}{"type": "join_ok", "bloque_id": bloqueID, "eco_id": ecoID, "player_id": playerID, "players": players, "wire_format": wireFormat}
	if ecoLabel != "" {
		payload["eco_label"] = ecoLabel
	}
	b, _ := json.Marshal(payload)
	return string(b)
}

func BuildPlayerJoined(bloqueID, playerID string, x, y, z float64) string {
	b, _ := json.Marshal(map[string]interface{}{"type": "player_joined", "bloque_id": bloqueID, "player_id": playerID, "position": map[string]float64{"x": x, "y": y, "z": z}})
	return string(b)
}

func BuildPlayerLeft(bloqueID, playerID string) string {
	b, _ := json.Marshal(map[string]string{"type": "player_left", "bloque_id": bloqueID, "player_id": playerID})
	return string(b)
}

func BuildJoinError(code string) string {
	b, _ := json.Marshal(map[string]string{"type": "join_error", "error": code})
	return string(b)
}

func BuildJoinErrorRedirect(wsURL string) string {
	b, _ := json.Marshal(map[string]string{"type": "join_error", "error": "wrong_game_server", "ws_url": wsURL})
	return string(b)
}
