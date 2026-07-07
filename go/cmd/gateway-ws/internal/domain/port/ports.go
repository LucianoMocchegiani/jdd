// Package port — Puertos del gateway (auth, registry, rate limit).
package port

import jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"

// TokenValidator representa token validator.
type TokenValidator interface {
	Validate(authHeader string, devBypass bool) (*jdauth.Claims, error)
}

// ResolveResult representa resolve result.
type ResolveResult struct {
	WSURL          string
	GameInstanceID string
	EcoID          int
}

// RegistryClient representa registry client.
type RegistryClient interface {
	Resolve(bloqueID, playerID string) (*ResolveResult, error)
}
