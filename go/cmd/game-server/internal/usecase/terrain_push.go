// Package usecase — Casos de uso: join, tick, input, terreno y destrucción.
package usecase

import (
	"encoding/json"
	"math"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/pkg/jd/chunkcoords"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

type TerrainPushManager struct {
	mu sync.Mutex
	byConn map[uint64]*entity.TerrainPushState
	nextSeq map[string]int
}

func NewTerrainPushManager() *TerrainPushManager {
	return &TerrainPushManager{byConn: make(map[uint64]*entity.TerrainPushState), nextSeq: make(map[string]int)}
}

func (m *TerrainPushManager) Remove(connID uint64) { m.mu.Lock(); defer m.mu.Unlock(); delete(m.byConn, connID) }
func (m *TerrainPushManager) nextRoundSeq(bloqueID string) int { m.mu.Lock(); defer m.mu.Unlock(); m.nextSeq[bloqueID]++; return m.nextSeq[bloqueID] }
func (m *TerrainPushManager) register(state *entity.TerrainPushState) { m.mu.Lock(); defer m.mu.Unlock(); m.byConn[state.ConnID] = state }
func (m *TerrainPushManager) statesForBloque(bloqueID string) []*entity.TerrainPushState {
	m.mu.Lock(); defer m.mu.Unlock()
	var out []*entity.TerrainPushState
	for _, st := range m.byConn { if st.BloqueID == bloqueID { out = append(out, st) } }
	return out
}
func (m *TerrainPushManager) get(connID uint64) (*entity.TerrainPushState, bool) { m.mu.Lock(); defer m.mu.Unlock(); st, ok := m.byConn[connID]; return st, ok }

type PushRoundOpts struct { IncludeTypes bool; OnlyNew bool }

func (s *Services) StartPushRound(connID uint64, bloqueID, playerID string, centerX, centerY float64, opts PushRoundOpts) {
	seq := s.TerrainPush.nextRoundSeq(bloqueID)
	state, exists := s.TerrainPush.get(connID)
	if !exists { state = entity.NewTerrainPushState(bloqueID, connID, centerX, centerY, seq); s.TerrainPush.register(state) } else { state.UpdateCenter(centerX, centerY); state.SetSeq(seq) }
	cfg := s.SessionCfg
	radius, chunkSize := cfg.TerrainCollisionLoadRadiusCells, cfg.ChunkSizeCells
	if opts.IncludeTypes { go s.fetchAndSendTypes(connID, bloqueID, centerX, centerY, radius) }
	keys := orderedChunkKeys(centerX, centerY, radius, chunkSize, state, opts.OnlyNew)
	state.SetPending(keys)
	for _, key := range keys {
		cx, cy := parseChunkKey(key)
		_ = s.TerrainPub.PublishChunkRequest(port.ChunkRequest{BloqueID: bloqueID, ChunkCX: cx, ChunkCY: cy, RequesterID: s.InstanceID, PlayerID: playerID})
	}
	if len(keys) == 0 { s.sendChunkDone(connID, bloqueID, seq, 0); if opts.OnlyNew { state.EndRefresh() } }
}

func (s *Services) fetchAndSendTypes(connID uint64, bloqueID string, cx, cy float64, radius int) {
	if s.TerrainTypes == nil { return }
	cfg := s.SessionCfg
	wire, err := s.TerrainTypes.FetchTypesViewport(bloqueID, int(math.Floor(cx)), int(math.Floor(cy)), radius, cfg.TerrainZMin, cfg.TerrainZMax)
	if err != nil || wire == "" { return }
	for _, sess := range s.Sessions.GetByBloque(bloqueID) { applyTypesWire(sess, wire) }
	s.enqueueTerrainConn(connID, wire)
}

func applyTypesWire(sess *entity.BlockSession, wire string) {
	var msg struct { Types []struct { Nombre string `json:"nombre"`; TipoFisico string `json:"tipo_fisico"`; Viscosidad *float64 `json:"viscosidad"` } `json:"types"` }
	if json.Unmarshal([]byte(wire), &msg) != nil { return }
	for _, t := range msg.Types { sess.ApplyType(t.Nombre, entity.TypeInfo{TipoFisico: t.TipoFisico, Viscosidad: t.Viscosidad}) }
}

func orderedChunkKeys(centerX, centerY float64, radius, chunkSize int, state *entity.TerrainPushState, onlyNew bool) []string {
	all := chunkcoords.KeysInRadius(centerX, centerY, radius, chunkSize)
	cx0 := chunkcoords.CoordFromCell(int(math.Floor(centerX)), chunkSize)
	cy0 := chunkcoords.CoordFromCell(int(math.Floor(centerY)), chunkSize)
	var keys []string
	for k := range all { if onlyNew && !state.NeedsChunk(k, true) { continue }; keys = append(keys, k) }
	sort.Slice(keys, func(i,j int) bool { ai,bi := sortKey(keys[i],cx0,cy0); aj,bj := sortKey(keys[j],cx0,cy0); if ai != aj { return ai < aj }; return bi < bj })
	return keys
}
func sortKey(key string, cx0, cy0 int) (int,int) { cx,cy := parseChunkKey(key); return abs(cx-cx0)+abs(cy-cy0), abs(cx)+abs(cy) }
func abs(v int) int { if v < 0 { return -v }; return v }
func parseChunkKey(key string) (int,int) { parts := strings.Split(key, ","); if len(parts) != 2 { return 0,0 }; cx,_ := strconv.Atoi(parts[0]); cy,_ := strconv.Atoi(parts[1]); return cx,cy }

func (s *Services) HandleChunkReady(ready port.ChunkReady) {
	particles := parseContactParticles(ready.WireJSON)
	for _, sess := range s.Sessions.GetByBloque(ready.BloqueID) {
		sess.SolidGrid.MergeSolidCells(ready.SolidCells)
		sess.SolidGrid.MergeContactParticles(particles)
	}
	key := chunkcoords.Key(ready.ChunkCX, ready.ChunkCY)
	for _, st := range s.TerrainPush.statesForBloque(ready.BloqueID) {
		matched, done := st.MarkChunkReady(key)
		if !matched { continue }
		if ready.WireJSON != "" { s.enqueueTerrainConn(st.ConnID, ready.WireJSON) }
		if done { seq, sent, _ := st.Snapshot(); s.sendChunkDone(st.ConnID, ready.BloqueID, seq, sent); st.EndRefresh() }
	}
}

func parseContactParticles(wire string) []jdmedium.Particle {
	var msg struct { Particles []struct { ID string `json:"id"`; X float64 `json:"x"`; Y float64 `json:"y"`; Z float64 `json:"z"`; Name string `json:"tipo_nombre"`; Physics string `json:"tipo_fisico"` } `json:"particles"` }
	if json.Unmarshal([]byte(wire), &msg) != nil { return nil }
	particles := make([]jdmedium.Particle, 0, len(msg.Particles))
	for _, p := range msg.Particles {
		if p.Name == "" || p.Physics == "" { continue }
		particles = append(particles, jdmedium.Particle{ID: p.ID, X: p.X, Y: p.Y, Z: p.Z, Name: p.Name, Physics: p.Physics})
	}
	return particles
}

func (s *Services) enqueueTerrainConn(connID uint64, wire string) { c, ok := s.Hub.Get(connID); if !ok { return }; select { case c.TerrainOut <- wire: default: } }
func (s *Services) sendChunkDone(connID uint64, bloqueID string, seq, chunksSent int) { s.enqueueTerrainConn(connID, BuildTerrainChunkDone(bloqueID, seq, chunksSent)) }
func BuildTerrainChunkDone(bloqueID string, seq, chunksSent int) string { payload := map[string]interface{}{"type":"terrain_chunk_done", "bloque_id":bloqueID, "seq":seq, "chunks_sent":chunksSent}; b,_ := json.Marshal(payload); return string(b) }
func (s *Services) DrainTerrainFanout() {
	s.Hub.ForEachConn(func(c *wshub.Conn) { for { select { case wire := <-c.TerrainOut: wshub.SafeWrite(c, wire); default: return } } })
}
func (s *Services) MaybeRefreshTerrain(sess *entity.BlockSession) {
	cfg := s.SessionCfg
	trigger := float64(cfg.TerrainRecenterTriggerCells)
	minInterval := time.Duration(cfg.TerrainRefreshMinIntervalSec * float64(time.Second))
	s.Hub.ForSession(sess.BloqueID, sess.EcoID, func(c *wshub.Conn) {
		st, ok := s.TerrainPush.get(c.ID); if !ok { return }
		p, ok := sess.GetPlayer(c.PlayerID); if !ok || st.DriftFrom(p.X,p.Y) < trigger || !st.TryStartRefresh(minInterval) { return }
		st.UpdateCenter(p.X,p.Y)
		s.StartPushRound(c.ID,sess.BloqueID,c.PlayerID,p.X,p.Y,PushRoundOpts{IncludeTypes:false,OnlyNew:true})
	})
}
