// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"log"

	jdwire "github.com/juego-de-dioses/jd/pkg/jd/wire"
)

// JoinBlockInput representa join block input.
type JoinBlockInput struct {
	BloqueID   string
	PlayerID   string
	WireFormat string
	X, Y, Z    float64
	Yaw      float64
	Pitch    float64
	ConnID   uint64
}

// JoinBlockResult representa join block result.
type JoinBlockResult struct {
	JoinOKJSON       string
	JoinErrJSON      string
	PlayerStates     []string
	PlayerJoinedJSON string
	IsNew            bool
}

// JoinBlock implementa join block.
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
		ecoID = resolved.EcoID
		ecoLabel = resolved.EcoLabel
	}

	sess := s.Sessions.GetOrCreate(in.BloqueID, ecoID)
	isNew, _ := sess.AddPlayer(in.PlayerID, in.X, in.Y, in.Z, in.Yaw, in.Pitch)
	s.Hub.Bind(in.ConnID, in.BloqueID, ecoID, in.PlayerID, wireFormat)
	tick := sess.IncrementTick()

	states := BuildAllPlayerStates(sess, tick)
	result := JoinBlockResult{
		JoinOKJSON:   BuildJoinOK(in.BloqueID, ecoID, ecoLabel, in.PlayerID, wireFormat, sess.PlayerIDs()),
		PlayerStates: states,
		IsNew:        isNew,
	}
	if isNew {
		result.PlayerJoinedJSON = BuildPlayerJoined(in.BloqueID, in.PlayerID, in.X, in.Y, in.Z)
	}

	s.StartPushRound(in.ConnID, in.BloqueID, in.PlayerID, in.X, in.Y, PushRoundOpts{
		IncludeTypes: true,
		OnlyNew:      false,
	})
	return result
}

// Leave implementa leave.
func (s *Services) Leave(connID uint64) (leftJSON, bloqueID string, ecoID int, ok bool) {
	s.TerrainPush.Remove(connID)
	bloqueID, playerID, ecoID, bound := s.Hub.Unbind(connID)
	if !bound {
		return "", "", 0, false
	}
	if s.Registry != nil {
		_ = s.Registry.Release(bloqueID, playerID, ecoID)
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
