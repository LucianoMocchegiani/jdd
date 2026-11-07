// Package config — Configuración de entorno del game-server.
package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	HTTPPort int
	RedisURL string
	TerrainServiceURL string
	RegistryURL string
	WSPublicURL string
	GameInstanceID string
	Env string
	JWTSecret string
	SessionJSONPath string
	CombatCatalogPath string
	MediumRulesPath string
	ParticleRegistryPath string
	WireFormat string
}

func Load() (Config, error) {
	port, _ := strconv.Atoi(getenv("HTTP_PORT", "8001"))
	return Config{
		HTTPPort: port, RedisURL: getenv("REDIS_URL", "redis://127.0.0.1:6379"),
		TerrainServiceURL: getenv("TERRAIN_SERVICE_URL", "http://127.0.0.1:8002"),
		RegistryURL: getenv("REGISTRY_URL", "http://127.0.0.1:8003"),
		WSPublicURL: getenv("WS_PUBLIC_URL", "ws://127.0.0.1:8001/ws"),
		GameInstanceID: getenv("GAME_INSTANCE_ID", "game-1"), Env: getenv("ENV", "dev"), JWTSecret: getenv("JWT_SECRET", "dev-secret"),
		SessionJSONPath: getenv("SESSION_JSON_PATH", "shared/game-data/game/session.json"),
		CombatCatalogPath: getenv("COMBAT_CATALOG_PATH", "shared/game-data/actions/body-actions.json"),
		MediumRulesPath: getenv("MEDIUM_RULES_PATH", "shared/game-data/medium/rules.json"),
		ParticleRegistryPath: getenv("PARTICLE_REGISTRY_PATH", "shared/game-data/particles/registry.json"),
		WireFormat: getenv("WIRE_FORMAT", "json"),
	}, nil
}

func (c Config) UseRegistry() bool { return c.RegistryURL != "" && c.RegistryURL != "off" }
func (c Config) DevBypassAuth() bool { return c.Env == "dev" }
func getenv(k, def string) string { if v := os.Getenv(k); v != "" { return v }; return def }
func (c Config) ListenAddr() string { return fmt.Sprintf(":%d", c.HTTPPort) }
