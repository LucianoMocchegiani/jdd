// Package http — API HTTP del registry.
package http

import (
	"encoding/json"
	"net/http"

	"github.com/juego-de-dioses/jd/cmd/registry/internal/usecase"
)

// Server representa server.
type Server struct {
	register *usecase.RegisterGameServer
	resolve  *usecase.ResolvePlayer
	release  *usecase.ReleasePlayer
	syncEco  *usecase.SyncEco
}

// NewServer construye server.
func NewServer(
	register *usecase.RegisterGameServer,
	resolve *usecase.ResolvePlayer,
	release *usecase.ReleasePlayer,
	syncEco *usecase.SyncEco,
) *Server {
	return &Server{
		register: register,
		resolve:  resolve,
		release:  release,
		syncEco:  syncEco,
	}
}

// Mount implementa mount.
func (s *Server) Mount(mux *http.ServeMux) {
	mux.HandleFunc("/health", healthHandler)
	mux.HandleFunc("/register", s.handleRegister)
	mux.HandleFunc("/heartbeat", s.handleHeartbeat)
	mux.HandleFunc("/resolve", s.handleResolve)
	mux.HandleFunc("/release", s.handleRelease)
	mux.HandleFunc("/sync-eco", s.handleSyncEco)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		InstanceID string `json:"instance_id"`
		WSURL      string `json:"ws_url"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.InstanceID == "" || body.WSURL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "instance_id and ws_url required"})
		return
	}
	if err := s.register.Register(r.Context(), body.InstanceID, body.WSURL); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "registered"})
}

func (s *Server) handleHeartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		InstanceID string `json:"instance_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.InstanceID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "instance_id required"})
		return
	}
	if err := s.register.Heartbeat(r.Context(), body.InstanceID); err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleResolve(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		BloqueID string `json:"bloque_id"`
		PlayerID string `json:"player_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.BloqueID == "" || body.PlayerID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bloque_id and player_id required"})
		return
	}
	asg, err := s.resolve.Resolve(r.Context(), body.BloqueID, body.PlayerID)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"eco_id":             asg.EcoID,
		"eco_label":          asg.EcoLabel,
		"ws_url":             asg.WSURL,
		"game_instance_id":   asg.GameInstanceID,
		"bloque_id":          asg.BloqueID,
	})
}

func (s *Server) handleRelease(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		BloqueID string `json:"bloque_id"`
		PlayerID string `json:"player_id"`
		EcoID    int    `json:"eco_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.BloqueID == "" || body.PlayerID == "" || body.EcoID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bloque_id, player_id and eco_id required"})
		return
	}
	if err := s.release.Release(r.Context(), body.BloqueID, body.PlayerID, body.EcoID); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "released"})
}

func (s *Server) handleSyncEco(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}
	var body struct {
		BloqueID string `json:"bloque_id"`
		PlayerID string `json:"player_id"`
		EcoID    int    `json:"eco_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.BloqueID == "" || body.PlayerID == "" || body.EcoID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "bloque_id, player_id and eco_id required"})
		return
	}
	asg, err := s.syncEco.Sync(r.Context(), body.BloqueID, body.PlayerID, body.EcoID)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"eco_id":           asg.EcoID,
		"eco_label":        asg.EcoLabel,
		"ws_url":           asg.WSURL,
		"game_instance_id": asg.GameInstanceID,
		"bloque_id":        asg.BloqueID,
	})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid json"})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func methodNotAllowed(w http.ResponseWriter) {
	writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}
