// Package config — Configuración del persistence-api.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config representa config.
type Config struct {
	HTTPPort                   int
	DatabaseURL                string
	RedisURL                   string
	MaxDestroyPerBlockPerSec   int
	CombatCatalogPath          string
}

// Load ejecuta load.
func Load() (Config, error) {
	port, _ := strconv.Atoi(getenv("HTTP_PORT", "8000"))
	maxDestroy, _ := strconv.Atoi(getenv("MAX_DESTROY_PER_BLOCK_PER_SEC", "50"))
	return Config{
		HTTPPort:                 port,
		DatabaseURL:              os.Getenv("DATABASE_URL"),
		RedisURL:                 getenv("REDIS_URL", "redis://127.0.0.1:6379"),
		MaxDestroyPerBlockPerSec: maxDestroy,
		CombatCatalogPath:        getenv("COMBAT_CATALOG_PATH", "shared/game-data/actions/combat-catalog.json"),
	}, nil
}

// ListenAddr implementa listen addr.
func (c Config) ListenAddr() string {
	return fmt.Sprintf(":%d", c.HTTPPort)
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
