// Package session — Carga de shared/game-data/game/session.json.
package session

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// Config mirrors shared/game-data/game/session.json (server + client).
type Config struct {
	Version                          int     `json:"version"`
	ContactSampleRadiusCells         int     `json:"contactSampleRadiusCells"`
	ViewportRadiusCells              int     `json:"viewportRadiusCells"`
	ChunkSizeCells                   int     `json:"chunkSizeCells"`
	PlayerMoveSpeedCells             float64 `json:"playerMoveSpeedCells"`
	GravityCells                     float64 `json:"gravityCells"`
	CameraDefaultPitch               float64 `json:"cameraDefaultPitch"`
	TerrainCollisionLoadRadiusCells  int     `json:"terrainCollisionLoadRadiusCells"`
	TerrainRecenterTriggerCells      int     `json:"terrainRecenterTriggerCells"`
	TerrainRefreshMinIntervalSec     float64 `json:"terrainRefreshMinIntervalSec"`
	TerrainZMin                      int     `json:"terrainZMin"`
	TerrainZMax                      int     `json:"terrainZMax"`
	TerrainWsMaxChunksPerTick        int     `json:"terrainWsMaxChunksPerTick"`
	MaxPlayersPerEco                 int     `json:"maxPlayersPerEco"`
	EcoSpawnThreshold                int     `json:"ecoSpawnThreshold"`
	MaxActiveNpcsPerEco              int     `json:"maxActiveNpcsPerEco"`
	MaxDestroyPerBlockPerSec         int     `json:"maxDestroyPerBlockPerSec"`
}

var (
	mu       sync.RWMutex
	cached   *Config
	loadPath string
)

// SetLoadPath overrides default session.json path (tests).
func SetLoadPath(path string) {
	mu.Lock()
	defer mu.Unlock()
	loadPath = path
	cached = nil
}

// DefaultPath returns session.json relative to repo root from cwd.
func DefaultPath() string {
	if loadPath != "" {
		return loadPath
	}
	return "shared/game-data/game/session.json"
}

// Load reads and caches session.json.
func Load() (*Config, error) {
	mu.RLock()
	if cached != nil {
		cfg := *cached
		mu.RUnlock()
		return &cfg, nil
	}
	mu.RUnlock()

	mu.Lock()
	defer mu.Unlock()
	if cached != nil {
		cfg := *cached
		return &cfg, nil
	}

	path := loadPath
	if path == "" {
		path = "shared/game-data/game/session.json"
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("session.Load: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("session.Load parse: %w", err)
	}
	applyDefaults(&cfg)
	cached = &cfg
	out := *cached
	return &out, nil
}

func applyDefaults(cfg *Config) {
	if cfg.ChunkSizeCells == 0 {
		cfg.ChunkSizeCells = 40
	}
	if cfg.TerrainCollisionLoadRadiusCells == 0 {
		cfg.TerrainCollisionLoadRadiusCells = 48
	}
	if cfg.MaxPlayersPerEco == 0 {
		cfg.MaxPlayersPerEco = 50
	}
	if cfg.EcoSpawnThreshold == 0 {
		cfg.EcoSpawnThreshold = 50
	}
	if cfg.MaxActiveNpcsPerEco == 0 {
		cfg.MaxActiveNpcsPerEco = 20
	}
	if cfg.MaxDestroyPerBlockPerSec == 0 {
		cfg.MaxDestroyPerBlockPerSec = 50
	}
}
