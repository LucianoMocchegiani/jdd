// Package config — Configuración del gateway WebSocket.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config representa config.
type Config struct {
	HTTPPort          int
	RegistryURL       string
	DefaultGameWSURL  string
	JWTSecret         string
	Env               string
	MaxConnPerIP      int
	ConnRateWindowSec int
}

// Load ejecuta load.
func Load() Config {
	port, _ := strconv.Atoi(getenv("HTTP_PORT", "8082"))
	maxConn, _ := strconv.Atoi(getenv("MAX_CONN_PER_IP", "20"))
	window, _ := strconv.Atoi(getenv("CONN_RATE_WINDOW_SEC", "60"))
	return Config{
		HTTPPort:          port,
		RegistryURL:       getenv("REGISTRY_URL", "http://127.0.0.1:8003"),
		DefaultGameWSURL:  getenv("DEFAULT_GAME_WS_URL", "ws://127.0.0.1:8001/ws"),
		JWTSecret:         getenv("JWT_SECRET", "dev-secret"),
		Env:               getenv("ENV", "dev"),
		MaxConnPerIP:      maxConn,
		ConnRateWindowSec: window,
	}
}

// DevBypassAuth implementa dev bypass auth.
func (c Config) DevBypassAuth() bool {
	return c.Env == "dev"
}

// UseRegistry implementa use registry.
func (c Config) UseRegistry() bool {
	return c.RegistryURL != "" && c.RegistryURL != "off"
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
