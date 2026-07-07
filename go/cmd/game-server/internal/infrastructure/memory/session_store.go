// Package memory — Almacén en memoria de sesiones activas.
package memory

import (
	"sync"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

// SessionStore representa session store.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*entity.BlockSession
}

// NewSessionStore construye session store.
func NewSessionStore() *SessionStore {
	return &SessionStore{sessions: make(map[string]*entity.BlockSession)}
}

// GetOrCreate implementa get or create.
func (s *SessionStore) GetOrCreate(bloqueID string, ecoID int) *entity.BlockSession {
	key := entity.SessionKey(bloqueID, ecoID)
	s.mu.Lock()
	defer s.mu.Unlock()
	if sess, ok := s.sessions[key]; ok {
		return sess
	}
	sess := entity.NewBlockSession(bloqueID, ecoID)
	s.sessions[key] = sess
	return sess
}

// Get implementa get.
func (s *SessionStore) Get(bloqueID string, ecoID int) (*entity.BlockSession, bool) {
	key := entity.SessionKey(bloqueID, ecoID)
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[key]
	return sess, ok
}

// GetByBloque implementa get by bloque.
func (s *SessionStore) GetByBloque(bloqueID string) []*entity.BlockSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []*entity.BlockSession
	for _, sess := range s.sessions {
		if sess.BloqueID == bloqueID {
			out = append(out, sess)
		}
	}
	return out
}

// RemoveIfEmpty implementa remove if empty.
func (s *SessionStore) RemoveIfEmpty(bloqueID string, ecoID int) {
	key := entity.SessionKey(bloqueID, ecoID)
	s.mu.Lock()
	defer s.mu.Unlock()
	sess, ok := s.sessions[key]
	if !ok || sess.PlayerCount() > 0 {
		return
	}
	delete(s.sessions, key)
}

// AllSessions implementa all sessions.
func (s *SessionStore) AllSessions() []*entity.BlockSession {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]*entity.BlockSession, 0, len(s.sessions))
	for _, sess := range s.sessions {
		out = append(out, sess)
	}
	return out
}

var _ port.SessionStore = (*SessionStore)(nil)
