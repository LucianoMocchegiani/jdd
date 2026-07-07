// Package entity — Entidades de dominio (sesión, jugador, terreno).
package entity

import (
	"sync"
	"time"
)

// TerrainPushState — ronda WS terreno por conexión (REF: TerrainWsSubscriber._PlayerPushState).
type TerrainPushState struct {
	mu                   sync.Mutex
	BloqueID             string
	ConnID               uint64
	CenterX              float64
	CenterY              float64
	Seq                  int
	SentChunks           map[string]struct{}
	PendingChunks        map[string]struct{}
	ChunksSentThisRound  int
	LastRefreshAt        time.Time
	RefreshInFlight      bool
}

// NewTerrainPushState construye terrain push state.
func NewTerrainPushState(bloqueID string, connID uint64, cx, cy float64, seq int) *TerrainPushState {
	return &TerrainPushState{
		BloqueID:      bloqueID,
		ConnID:        connID,
		CenterX:       cx,
		CenterY:       cy,
		Seq:           seq,
		SentChunks:    make(map[string]struct{}),
		PendingChunks: make(map[string]struct{}),
	}
}

// SetPending implementa set pending.
func (p *TerrainPushState) SetPending(keys []string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.PendingChunks = make(map[string]struct{}, len(keys))
	p.ChunksSentThisRound = 0
	for _, k := range keys {
		p.PendingChunks[k] = struct{}{}
	}
}

// MarkChunkReady implementa mark chunk ready.
func (p *TerrainPushState) MarkChunkReady(key string) (matched bool, done bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, waiting := p.PendingChunks[key]; !waiting {
		return false, false
	}
	delete(p.PendingChunks, key)
	p.SentChunks[key] = struct{}{}
	p.ChunksSentThisRound++
	return true, len(p.PendingChunks) == 0
}

// SetSeq implementa set seq.
func (p *TerrainPushState) SetSeq(seq int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.Seq = seq
}

// DriftFrom implementa drift from.
func (p *TerrainPushState) DriftFrom(cx, cy float64) float64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	dx := cx - p.CenterX
	if dx < 0 {
		dx = -dx
	}
	dy := cy - p.CenterY
	if dy < 0 {
		dy = -dy
	}
	if dx > dy {
		return dx
	}
	return dy
}

// UpdateCenter implementa update center.
func (p *TerrainPushState) UpdateCenter(cx, cy float64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.CenterX, p.CenterY = cx, cy
}

// Snapshot implementa snapshot.
func (p *TerrainPushState) Snapshot() (seq, sent int, pending int) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.Seq, p.ChunksSentThisRound, len(p.PendingChunks)
}

// TryStartRefresh implementa try start refresh.
func (p *TerrainPushState) TryStartRefresh(minInterval time.Duration) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.RefreshInFlight {
		return false
	}
	if time.Since(p.LastRefreshAt) < minInterval {
		return false
	}
	p.RefreshInFlight = true
	p.LastRefreshAt = time.Now()
	return true
}

// EndRefresh implementa end refresh.
func (p *TerrainPushState) EndRefresh() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.RefreshInFlight = false
}

// NeedsChunk implementa needs chunk.
func (p *TerrainPushState) NeedsChunk(key string, onlyNew bool) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if onlyNew {
		_, sent := p.SentChunks[key]
		return !sent
	}
	return true
}
