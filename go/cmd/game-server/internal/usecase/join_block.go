// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"log"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	jdwire "github.com/juego-de-dioses/jd/pkg/jd/wire"
)

type JoinBlockInput struct {
	BloqueID, PlayerID, WireFormat string
	X, Y, Z, Yaw, Pitch            float64
	ConnID                         uint64
	DeferActivation                bool
}

type JoinBlockResult struct {
	JoinOKJSON       string
	JoinErrJSON      string
	PlayerStates     []string
	PlayerJoinedJSON string
	IsNew            bool
}

func (s *Services) JoinBlock(in JoinBlockInput) JoinBlockResult {
	ecoID := 1
	ecoLabel := "Eco 1"
	wireFormat := jdwire.ResolveFormat(in.WireFormat, s.ServerWire)
	if s.Registry != nil {
		resolved, err := s.Registry.Resolve(in.BloqueID, in.PlayerID)
		if err != nil {
			log.Printf("registry resolve: %v", err)
			return JoinBlockResult{JoinErrJSON: BuildJoinError("registry_unavailable")}
		}
		if resolved.GameInstanceID != "" && resolved.GameInstanceID != s.InstanceID {
			return JoinBlockResult{JoinErrJSON: BuildJoinErrorRedirect(resolved.WSURL)}
		}
		ecoID, ecoLabel = resolved.EcoID, resolved.EcoLabel
	}
	if in.DeferActivation {
		s.Hub.BindPending(in.ConnID, wshub.JoinInfo{
			BloqueID: in.BloqueID, EcoID: ecoID, EcoLabel: ecoLabel, PlayerID: in.PlayerID, WireFormat: wireFormat,
			X: in.X, Y: in.Y, Z: in.Z, Yaw: in.Yaw, Pitch: in.Pitch,
		})
		// Keep the session's collision grid available while chunks arrive, without adding a player.
		s.Sessions.GetOrCreate(in.BloqueID, ecoID)
	} else {
		s.Hub.Bind(in.ConnID, in.BloqueID, ecoID, in.PlayerID, wireFormat)
	}
	result := JoinBlockResult{}
	if !in.DeferActivation {
		sess := s.Sessions.GetOrCreate(in.BloqueID, ecoID)
		isNew, _ := sess.AddPlayer(in.PlayerID, in.X, in.Y, in.Z, in.Yaw, in.Pitch)
		result.IsNew = isNew
		result.JoinOKJSON = BuildJoinOK(in.BloqueID, ecoID, ecoLabel, in.PlayerID, wireFormat, sess.PlayerIDs())
		result.PlayerStates = BuildAllPlayerStates(sess, sess.IncrementTick())
		if isNew {
			result.PlayerJoinedJSON = BuildPlayerJoined(in.BloqueID, in.PlayerID, in.X, in.Y, in.Z)
		}
	}
	if in.DeferActivation {
		s.fetchAndSendTypes(in.ConnID, in.BloqueID, in.X, in.Y, s.SessionCfg.TerrainCollisionLoadRadiusCells)
		s.StartPushRound(in.ConnID, in.BloqueID, in.PlayerID, in.X, in.Y, PushRoundOpts{})
		return result
	}
	s.StartPushRound(in.ConnID, in.BloqueID, in.PlayerID, in.X, in.Y, PushRoundOpts{IncludeTypes: true})
	return result
}

func (s *Services) ActivatePlayer(connID uint64, position [3]float64) JoinBlockResult {
	join, ok := s.Hub.PendingJoin(connID)
	if !ok {
		return JoinBlockResult{JoinErrJSON: BuildJoinError("join_not_pending")}
	}
	if s.TerrainPush == nil || !s.TerrainPush.IsReady(connID) {
		return JoinBlockResult{JoinErrJSON: BuildJoinError("terrain_not_ready")}
	}
	join.X, join.Y, join.Z = position[0], position[1], position[2]
	sess := s.Sessions.GetOrCreate(join.BloqueID, join.EcoID)
	isNew, _ := sess.AddPlayer(join.PlayerID, join.X, join.Y, join.Z, join.Yaw, join.Pitch)
	if !s.Hub.MarkActive(connID) {
		return JoinBlockResult{JoinErrJSON: BuildJoinError("join_not_pending")}
	}
	result := JoinBlockResult{
		JoinOKJSON: BuildJoinOK(join.BloqueID, join.EcoID, join.EcoLabel, join.PlayerID, join.WireFormat, sess.PlayerIDs()),
		PlayerStates: BuildAllPlayerStates(sess, sess.IncrementTick()), IsNew: isNew,
	}
	if isNew {
		result.PlayerJoinedJSON = BuildPlayerJoined(join.BloqueID, join.PlayerID, join.X, join.Y, join.Z)
	}
	return result
}

func (s *Services) Leave(connID uint64) (leftJSON, bloqueID string, ecoID int, ok bool) {
	if s.TerrainPush != nil {
		s.TerrainPush.Remove(connID)
	}
	active := s.Hub.IsActive(connID)
	bloqueID, playerID, ecoID, bound := s.Hub.Unbind(connID)
	if !bound {
		return "", "", 0, false
	}
	if s.Registry != nil {
		_ = s.Registry.Release(bloqueID, playerID, ecoID)
	}
	if !active {
		return "", bloqueID, ecoID, false
	}
	sess, exists := s.Sessions.Get(bloqueID, ecoID)
	if !exists {
		return "", bloqueID, ecoID, false
	}
	sess.RemovePlayer(playerID)
	leftJSON = BuildPlayerLeft(bloqueID, playerID)
	s.Sessions.RemoveIfEmpty(bloqueID, ecoID)
	return leftJSON, bloqueID, ecoID, true
}
