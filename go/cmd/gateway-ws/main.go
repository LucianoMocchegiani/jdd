// Package main — Punto de entrada WebSocket con JWT y proxy al game-server.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	authinfra "github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/infrastructure/auth"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/infrastructure/httpclient"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/infrastructure/ratelimit"

	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/config"
	wsdelivery "github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/delivery/ws"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/gateway-ws/internal/usecase"
)

func main() {
	cfg := config.Load()

	var registry port.RegistryClient
	if cfg.UseRegistry() {
		registry = httpclient.NewRegistryClient(cfg.RegistryURL)
	} else {
		registry = httpclient.NewNoopRegistry(cfg.DefaultGameWSURL)
	}

	validator := authinfra.NewJWTValidator(cfg.JWTSecret)
	proxy := usecase.NewProxySession(registry, cfg.DefaultGameWSURL)
	limiter := ratelimit.NewIPLimiter(cfg.MaxConnPerIP, cfg.ConnRateWindowSec)
	gateway := wsdelivery.NewGateway(cfg, validator, proxy, limiter)

	mux := http.NewServeMux()
	gateway.Mount(mux)

	srv := &http.Server{Addr: cfg.ListenAddr(), Handler: mux}
	go func() {
		log.Printf("gateway-ws listening on %s (env=%s)", cfg.ListenAddr(), cfg.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
