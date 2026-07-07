// Package ws — Servidor WebSocket y handlers de mensajes cliente.
package ws

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/config"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
	jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Server representa server.
type Server struct {
	cfg config.Config
	svc *usecase.Services
	hub *wshub.Hub
}

// NewServer construye server.
func NewServer(cfg config.Config, svc *usecase.Services, hub *wshub.Hub) *Server {
	return &Server{cfg: cfg, svc: svc, hub: hub}
}

// HandleWS implementa handle ws.
func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	claims, ok := s.authenticate(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	conn := s.hub.Register(ws)
	conn.Claims = claims
	defer func() {
		if left, bloqueID, ecoID, ok := s.svc.Leave(conn.ID); ok {
			s.hub.ForSession(bloqueID, ecoID, func(c *wshub.Conn) {
				wshub.SafeWrite(c, left)
			})
		}
		s.hub.Remove(conn.ID)
		_ = ws.Close()
	}()

	for {
		_, raw, err := ws.ReadMessage()
		if err != nil {
			return
		}
		s.dispatch(conn, string(raw))
	}
}

func (s *Server) authenticate(r *http.Request) (*jdauth.Claims, bool) {
	if s.cfg.DevBypassAuth() {
		return nil, true
	}
	claims, err := jdauth.ParseBearer(r.Header.Get("Authorization"), s.cfg.JWTSecret)
	return claims, err == nil
}

func (s *Server) dispatch(c *wshub.Conn, raw string) {
	var msg map[string]interface{}
	if json.Unmarshal([]byte(raw), &msg) != nil {
		return
	}
	t, _ := msg["type"].(string)
	switch t {
	case "join_block":
		s.handleJoin(c, msg)
	case "input":
		s.handleInput(c, msg)
	case "swing":
		s.handleSwing(c, msg, raw)
	}
}

func (s *Server) handleJoin(c *wshub.Conn, msg map[string]interface{}) {
	bloqueID, _ := msg["bloque_id"].(string)
	playerID, _ := msg["player_id"].(string)
	if !s.cfg.DevBypassAuth() && c.Claims != nil {
		playerID = c.Claims.PlayerID
	} else if !s.cfg.DevBypassAuth() {
		wshub.SafeWrite(c, usecase.BuildJoinError("unauthorized"))
		return
	}
	pos, ok := parsePosition(msg["position"])
	if bloqueID == "" || playerID == "" || !ok {
		wshub.SafeWrite(c, usecase.BuildJoinError("invalid_join_payload"))
		return
	}
	yaw, pitch := 0.0, 0.0
	if v, ok := msg["yaw"].(float64); ok {
		yaw = v
	}
	if v, ok := msg["pitch"].(float64); ok {
		pitch = v
	}
	wirePref, _ := msg["wire_format"].(string)
	res := s.svc.JoinBlock(usecase.JoinBlockInput{
		BloqueID:   bloqueID,
		PlayerID:   playerID,
		WireFormat: wirePref,
		X:        pos[0],
		Y:        pos[1],
		Z:        pos[2],
		Yaw:      yaw,
		Pitch:    pitch,
		ConnID:   c.ID,
	})
	if res.JoinErrJSON != "" {
		wshub.SafeWrite(c, res.JoinErrJSON)
		return
	}
	for _, st := range res.PlayerStates {
		wshub.WritePlayerState(c, st)
	}
	if res.IsNew && res.PlayerJoinedJSON != "" {
		s.hub.ForSessionExcept(c.BloqueID, c.EcoID, playerID, func(o *wshub.Conn) {
			wshub.SafeWrite(o, res.PlayerJoinedJSON)
		})
	}
	wshub.SafeWrite(c, res.JoinOKJSON)
}

func (s *Server) handleInput(c *wshub.Conn, msg map[string]interface{}) {
	bloqueID := c.BloqueID
	if v, _ := msg["bloque_id"].(string); v != "" {
		bloqueID = v
	}
	playerID, _ := msg["player_id"].(string)
	in := usecase.InputPayload{BloqueID: bloqueID, EcoID: c.EcoID, PlayerID: playerID}
	if v, ok := msg["seq"].(float64); ok {
		in.Seq = int(v)
	}
	if intents, ok := msg["intents"].(map[string]interface{}); ok {
		in.Intents = parseIntents(intents)
	}
	if v, ok := msg["yaw"].(float64); ok {
		in.Yaw = &v
	}
	if v, ok := msg["pitch"].(float64); ok {
		in.Pitch = &v
	}
	if errJSON, ok := s.svc.HandleInput(in); !ok {
		wshub.SafeWrite(c, errJSON)
	}
}

func (s *Server) handleSwing(c *wshub.Conn, msg map[string]interface{}, _ string) {
	bloqueID := c.BloqueID
	if v, _ := msg["bloque_id"].(string); v != "" {
		bloqueID = v
	}
	actionID, _ := msg["action_id"].(string)
	entityF, _ := msg["entity_id"].(float64)
	seqF, _ := msg["seq"].(float64)
	pos, _ := msg["position"].(map[string]interface{})
	px, py, pz := 0.0, 0.0, 0.0
	if pos != nil {
		px, _ = pos["x"].(float64)
		py, _ = pos["y"].(float64)
		pz, _ = pos["z"].(float64)
	}
	playerID := c.PlayerID
	if playerID == "" {
		playerID, _ = msg["player_id"].(string)
	}
	resp, isErr := s.svc.HandleSwing(usecase.SwingPayload{
		BloqueID: bloqueID,
		EcoID:    c.EcoID,
		PlayerID: playerID,
		ActionID: actionID,
		EntityID: int(entityF),
		Seq:      int(seqF),
		PosX:     px,
		PosY:     py,
		PosZ:     pz,
	})
	wshub.SafeWrite(c, resp)
	if isErr {
		log.Printf("swing failed: %s", resp)
	}
}

func parsePosition(raw interface{}) ([3]float64, bool) {
	m, ok := raw.(map[string]interface{})
	if !ok {
		return [3]float64{}, false
	}
	x, ok1 := m["x"].(float64)
	y, ok2 := m["y"].(float64)
	z, ok3 := m["z"].(float64)
	if !ok1 || !ok2 || !ok3 {
		return [3]float64{}, false
	}
	return [3]float64{x, y, z}, true
}

func parseIntents(raw map[string]interface{}) map[string]bool {
	out := make(map[string]bool)
	for k, v := range raw {
		if b, ok := v.(bool); ok && b {
			out[k] = true
		}
	}
	return out
}

// HealthHandler ejecuta health handler.
func HealthHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}
