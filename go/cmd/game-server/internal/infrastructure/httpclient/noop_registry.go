// Package httpclient — Clientes HTTP hacia registry y terrain.
package httpclient

import (
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
)

type noopRegistry struct{}

// NewNoopRegistry construye noop registry.
func NewNoopRegistry() port.RegistryClient {
	return noopRegistry{}
}

// Resolve implementa resolve.
func (noopRegistry) Resolve(_, _ string) (*port.ResolveResult, error) {
	return &port.ResolveResult{
		EcoID:          1,
		EcoLabel:       "Eco 1",
		GameInstanceID: "",
	}, nil
}

// Release implementa release.
func (noopRegistry) Release(_, _ string, _ int) error { return nil }
// Register implementa register.
func (noopRegistry) Register(_, _ string) error       { return nil }
// Heartbeat implementa heartbeat.
func (noopRegistry) Heartbeat(_ string) error       { return nil }

var _ port.RegistryClient = noopRegistry{}
