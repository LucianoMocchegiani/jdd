// Package auth — JWT HS256 compartido (gateway y stubs).
package auth

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrMissingToken = errors.New("missing bearer token")
	ErrInvalidToken = errors.New("invalid token")
)

// Claims representa claims.
type Claims struct {
	Sub      string `json:"sub"`
	PlayerID string `json:"player_id"`
	jwt.RegisteredClaims
}

// ExtractBearer ejecuta extract bearer.
func ExtractBearer(authHeader string) (string, error) {
	if authHeader == "" {
		return "", ErrMissingToken
	}
	const prefix = "Bearer "
	if !strings.HasPrefix(authHeader, prefix) {
		return "", ErrInvalidToken
	}
	token := strings.TrimSpace(strings.TrimPrefix(authHeader, prefix))
	if token == "" {
		return "", ErrMissingToken
	}
	return token, nil
}

// ParseBearer ejecuta parse bearer.
func ParseBearer(authHeader, secret string) (*Claims, error) {
	tokenString, err := ExtractBearer(authHeader)
	if err != nil {
		return nil, err
	}
	return ParseToken(tokenString, secret)
}

// ParseToken ejecuta parse token.
func ParseToken(tokenString, secret string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithLeeway(30*time.Second))
	if err != nil {
		return nil, ErrInvalidToken
	}
	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, ErrInvalidToken
	}
	if claims.PlayerID == "" {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// SignToken — helper para tests y dev tooling.
func SignToken(secret string, claims Claims, ttl time.Duration) (string, error) {
	if claims.PlayerID == "" {
		return "", errors.New("player_id required")
	}
	now := time.Now()
	claims.RegisteredClaims = jwt.RegisteredClaims{
		Subject:   claims.Sub,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}
