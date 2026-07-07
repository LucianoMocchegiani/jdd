// Package port — Puertos hexagonales del game-server.
package port

// ResolveResult representa resolve result.
type ResolveResult struct {
	EcoID          int
	EcoLabel       string
	WSURL          string
	GameInstanceID string
}

// RegistryClient representa registry client.
type RegistryClient interface {
	Resolve(bloqueID, playerID string) (*ResolveResult, error)
	Release(bloqueID, playerID string, ecoID int) error
	Register(instanceID, wsURL string) error
	Heartbeat(instanceID string) error
}
