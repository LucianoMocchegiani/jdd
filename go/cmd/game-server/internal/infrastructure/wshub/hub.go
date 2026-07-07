// Package wshub — Hub de conexiones WebSocket por sala.
package wshub

import (
	"sync"

	"github.com/gorilla/websocket"

	jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"
	"github.com/juego-de-dioses/jd/pkg/jd/wire"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
)

// Hub representa hub.
type Hub struct {
	mu          sync.RWMutex
	conns       map[uint64]*Conn
	bySession   map[string]map[uint64]struct{}
	nextID      uint64
}

// Conn representa conn.
type Conn struct {
	ID         uint64
	BloqueID   string
	EcoID      int
	PlayerID   string
	Claims     *jdauth.Claims
	WireFormat string
	WS         *websocket.Conn
	TerrainOut chan string
}

// NewHub construye hub.
func NewHub() *Hub {
	return &Hub{
		conns:     make(map[uint64]*Conn),
		bySession: make(map[string]map[uint64]struct{}),
	}
}

// Register implementa register.
func (h *Hub) Register(ws *websocket.Conn) *Conn {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.nextID++
	c := &Conn{
		ID:         h.nextID,
		WS:         ws,
		TerrainOut: make(chan string, 256),
	}
	h.conns[c.ID] = c
	return c
}

// Bind implementa bind.
func (h *Hub) Bind(connID uint64, bloqueID string, ecoID int, playerID, wireFormat string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	c, ok := h.conns[connID]
	if !ok {
		return
	}
	c.BloqueID = bloqueID
	c.EcoID = ecoID
	c.PlayerID = playerID
	c.WireFormat = wireFormat
	key := entity.SessionKey(bloqueID, ecoID)
	if h.bySession[key] == nil {
		h.bySession[key] = make(map[uint64]struct{})
	}
	h.bySession[key][connID] = struct{}{}
}

// Unbind implementa unbind.
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
	}
	c.BloqueID, c.PlayerID, c.EcoID = "", "", 0
	c.WireFormat = ""
	return bloqueID, playerID, ecoID, bloqueID != ""
}

// Remove implementa remove.
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

// Get implementa get.
func (h *Hub) Get(connID uint64) (*Conn, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	c, ok := h.conns[connID]
	return c, ok
}

// ForSession implementa for session.
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

// ForSessionExcept implementa for session except.
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

// SafeWrite ejecuta safe write.
func SafeWrite(c *Conn, msg string) {
	if c == nil || c.WS == nil {
		return
	}
	_ = c.WS.WriteMessage(websocket.TextMessage, []byte(msg))
}

// WritePlayerState ejecuta write player state.
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
		_ = c.WS.WriteMessage(websocket.BinaryMessage, b)
		return
	}
	SafeWrite(c, jsonPayload)
}

// ForEachConn implementa for each conn.
func (h *Hub) ForEachConn(fn func(*Conn)) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, c := range h.conns {
		fn(c)
	}
}
