// Package config — Configuración del registry.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config representa config.
type Config struct {
	HTTPPort          int
	RedisURL          string
	MaxPlayersPerEco  int
	EcoSpawnThreshold int
	PlayerMappingTTL  int // seconds
	GameHeartbeatTTL  int // seconds
}

// Load ejecuta load.
func Load() Config {
	port, _ := strconv.Atoi(getenv("HTTP_PORT", "8003"))
	maxEco, _ := strconv.Atoi(getenv("MAX_PLAYERS_PER_ECO", "50"))
	threshold, _ := strconv.Atoi(getenv("ECO_SPAWN_THRESHOLD", "50"))
	playerTTL, _ := strconv.Atoi(getenv("PLAYER_MAPPING_TTL_SEC", "3600"))
	gameTTL, _ := strconv.Atoi(getenv("GAME_HEARTBEAT_TTL_SEC", "30"))
	return Config{
		HTTPPort:          port,
		RedisURL:          getenv("REDIS_URL", "redis://127.0.0.1:6379"),
		MaxPlayersPerEco:  maxEco,
		EcoSpawnThreshold: threshold,
		PlayerMappingTTL:  playerTTL,
		GameHeartbeatTTL:  gameTTL,
	}
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
