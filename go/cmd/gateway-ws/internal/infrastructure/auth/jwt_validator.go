// Package auth — Validación JWT HS256.
package auth

import (
	jdauth "github.com/juego-de-dioses/jd/pkg/jd/auth"

	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/domain/port"
)

// JWTValidator representa jwt validator.
type JWTValidator struct {
	secret string
}

// NewJWTValidator construye jwt validator.
func NewJWTValidator(secret string) *JWTValidator {
	return &JWTValidator{secret: secret}
}

// Validate implementa validate.
func (v *JWTValidator) Validate(authHeader string, devBypass bool) (*jdauth.Claims, error) {
	if devBypass {
		return nil, nil
	}
	return jdauth.ParseBearer(authHeader, v.secret)
}

var _ port.TokenValidator = (*JWTValidator)(nil)
