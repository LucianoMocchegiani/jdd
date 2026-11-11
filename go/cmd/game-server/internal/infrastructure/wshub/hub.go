// Package wshub — Hub de conexiones WebSocket por sala.
package wshub

import (
	"sync"

	"github.com/gorilla/websocket"

	jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"
	"github.com/juego-de-dioses/jd/pkg/jd/wire"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
)

type Hub struct {
	mu             sync.RWMutex
	conns          map[uint64]*Conn
	bySession      map[string]map[uint64]struct{}
	activeByPlayer map[string]uint64
	nextID         uint64
}

type JoinInfo struct {
	BloqueID, PlayerID, WireFormat, EcoLabel string
	EcoID                                    int
	X, Y, Z, Yaw, Pitch                      float64
}

type Conn struct {
	ID         uint64
	BloqueID   string
	EcoID      int
	PlayerID   string
	Claims     *jdauth.Claims
	WireFormat string
	Active     bool
	join       JoinInfo
	WS         *websocket.Conn
	writeMu    sync.Mutex
	TerrainOut chan string
}

func NewHub() *Hub {
	return &Hub{conns: make(map[uint64]*Conn), bySession: make(map[string]map[uint64]struct{}), activeByPlayer: make(map[string]uint64)}
}

func (h *Hub) Register(ws *websocket.Conn) *Conn {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.nextID++
	c := &Conn{ID: h.nextID, WS: ws, TerrainOut: make(chan string, 256)}
	h.conns[c.ID] = c
	return c
}

// Bind une una conexión y marca al jugador como activo (flujo legacy).
func (h *Hub) Bind(connID uint64, bloqueID string, ecoID int, playerID, wireFormat string) {
	h.bind(connID, JoinInfo{BloqueID: bloqueID, EcoID: ecoID, PlayerID: playerID, WireFormat: wireFormat}, true)
}

// BindPending registra la conexión para cargar terreno sin activar al jugador.
func (h *Hub) BindPending(connID uint64, join JoinInfo) { h.bind(connID, join, false) }

func activePlayerKey(bloqueID string, ecoID int, playerID string) string {
	return entity.SessionKey(bloqueID, ecoID) + "\x00" + playerID
}

func (h *Hub) bind(connID uint64, join JoinInfo, active bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.conns[connID]
	if !ok {
		return
	}
	c.BloqueID, c.EcoID, c.PlayerID = join.BloqueID, join.EcoID, join.PlayerID
	c.WireFormat, c.Active, c.join = join.WireFormat, active, join
	key := entity.SessionKey(join.BloqueID, join.EcoID)
	if h.bySession[key] == nil {
		h.bySession[key] = make(map[uint64]struct{})
	}
	h.bySession[key][connID] = struct{}{}
	if active {
		h.activeByPlayer[activePlayerKey(join.BloqueID, join.EcoID, join.PlayerID)] = connID
	}
}

func (h *Hub) PendingJoin(connID uint64) (JoinInfo, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c, ok := h.conns[connID]
	if !ok || c.Active || c.join.BloqueID == "" {
		return JoinInfo{}, false
	}
	return c.join, true
}

func (h *Hub) MarkActive(connID uint64) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.conns[connID]
	if !ok || c.Active || c.join.BloqueID == "" {
		return false
	}
	c.Active = true
	h.activeByPlayer[activePlayerKey(c.BloqueID, c.EcoID, c.PlayerID)] = connID
	return true
}

func (h *Hub) IsActive(connID uint64) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c, ok := h.conns[connID]
	return ok && c.Active && h.activeByPlayer[activePlayerKey(c.BloqueID, c.EcoID, c.PlayerID)] == connID
}

func (h *Hub) Unbind(connID uint64) (bloqueID, playerID string, ecoID int, ok bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, exists := h.conns[connID]
	if !exists {
		return "", "", 0, false
	}
	bloqueID, playerID, ecoID = c.BloqueID, c.PlayerID, c.EcoID
	if bloqueID != "" {
		key := entity.SessionKey(bloqueID, ecoID)
		if m := h.bySession[key]; m != nil {
			delete(m, connID)
			if len(m) == 0 {
				delete(h.bySession, key)
			}
		}
		activeKey := activePlayerKey(bloqueID, ecoID, playerID)
		if h.activeByPlayer[activeKey] == connID {
			delete(h.activeByPlayer, activeKey)
		}
	}
	c.BloqueID, c.PlayerID, c.EcoID = "", "", 0
	c.WireFormat, c.Active, c.join = "", false, JoinInfo{}
	return bloqueID, playerID, ecoID, bloqueID != ""
}

func (h *Hub) Remove(connID uint64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.conns[connID]
	if !ok {
		return
	}
	if c.BloqueID != "" {
		key := entity.SessionKey(c.BloqueID, c.EcoID)
		if m := h.bySession[key]; m != nil {
			delete(m, connID)
		}
	}
	delete(h.conns, connID)
}

func (h *Hub) Get(connID uint64) (*Conn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c, ok := h.conns[connID]
	return c, ok
}

func (h *Hub) ForSession(bloqueID string, ecoID int, fn func(*Conn)) {
	key := entity.SessionKey(bloqueID, ecoID)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for id := range h.bySession[key] {
		if c, ok := h.conns[id]; ok {
			fn(c)
		}
	}
}

func (h *Hub) ForSessionExcept(bloqueID string, ecoID int, playerID string, fn func(*Conn)) {
	key := entity.SessionKey(bloqueID, ecoID)
	h.mu.RLock()
	defer h.mu.RUnlock()
	for id := range h.bySession[key] {
		c, ok := h.conns[id]
		if ok && c.PlayerID != playerID {
			fn(c)
		}
	}
}

func SafeWrite(c *Conn, msg string) {
	if c == nil || c.WS == nil {
		return
	}
	c.writeMu.Lock()
	defer c.writeMu.Unlock()
	_ = c.WS.WriteMessage(websocket.TextMessage, []byte(msg))
}

func WritePlayerState(c *Conn, jsonPayload string) {
	if c == nil || c.WS == nil {
		return
	}
	if c.WireFormat == wire.FormatMsgpack {
		b, err := wire.EncodePlayerStateFromJSON(jsonPayload)
		if err != nil {
			SafeWrite(c, jsonPayload)
			return
		}
		c.writeMu.Lock()
		defer c.writeMu.Unlock()
		_ = c.WS.WriteMessage(websocket.BinaryMessage, b)
		return
	}
	SafeWrite(c, jsonPayload)
}

func (h *Hub) ForEachConn(fn func(*Conn)) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.conns {
		fn(c)
	}
}
