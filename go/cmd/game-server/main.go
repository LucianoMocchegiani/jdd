// Package main — Simulación autoritativa por bloque: WebSocket, tick ECS y terreno.
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/config"
	wsdelivery "github.com/juego-de-dioses/jd/cmd/game-server/internal/delivery/ws"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/httpclient"
	redisinfra "github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/redis"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
	"github.com/juego-de-dioses/jd/pkg/jd/session"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	session.SetLoadPath(resolveSessionPath(cfg.SessionJSONPath))
	sessionCfg, err := session.Load()
	if err != nil {
		log.Fatalf("session.json: %v", err)
	}

	opt, err := goredis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis url: %v", err)
	}
	rdb := goredis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	hub := wshub.NewHub()
	store := memory.NewSessionStore()
	terrainPub := redisinfra.NewTerrainPublisher(rdb)
	swingPub := redisinfra.NewSwingPublisher(rdb)
	terrainSub := redisinfra.NewTerrainSubscriber(rdb, cfg.GameInstanceID)
	terrainTypes := httpclient.NewTerrainTypesClient(cfg.TerrainServiceURL)

	var registry port.RegistryClient
	if cfg.UseRegistry() {
		registry = httpclient.NewRegistryClient(cfg.RegistryURL)
	} else {
		registry = httpclient.NewNoopRegistry()
	}

	svc := &usecase.Services{
		Sessions:     store,
		TerrainPub:   terrainPub,
		TerrainTypes: terrainTypes,
		SwingPub:     swingPub,
		Registry:     registry,
		Hub:          hub,
		SessionCfg:   sessionCfg,
		InstanceID:   cfg.GameInstanceID,
		ServerWire:   cfg.WireFormat,
		TerrainPush:  usecase.NewTerrainPushManager(),
	}

	if cfg.UseRegistry() {
		if err := registry.Register(cfg.GameInstanceID, cfg.WSPublicURL); err != nil {
			log.Printf("registry register: %v", err)
		}
		go runRegistryHeartbeat(registry, cfg.GameInstanceID, cfg.WSPublicURL)
	}

	readyCh := make(chan port.ChunkReady, 256)
	go func() {
		if err := terrainSub.Run(readyCh); err != nil {
			log.Printf("terrain subscriber: %v", err)
		}
	}()
	go func() {
		for ready := range readyCh {
			svc.HandleChunkReady(ready)
		}
	}()

	eventsSub := redisinfra.NewGameEventsSubscriber(rdb, cfg.GameInstanceID, svc)
	go func() {
		if err := eventsSub.Run(context.Background()); err != nil {
			log.Printf("game events subscriber: %v", err)
		}
	}()

	go runTickLoop(svc)

	wsServer := wsdelivery.NewServer(cfg, svc, hub)
	mux := http.NewServeMux()
	mux.HandleFunc("/health", wsdelivery.HealthHandler)
	mux.HandleFunc("/ws", wsServer.HandleWS)

	srv := &http.Server{Addr: cfg.ListenAddr(), Handler: mux}
	go func() {
		log.Printf("game-server listening on %s (instance=%s)", cfg.ListenAddr(), cfg.GameInstanceID)
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

func runTickLoop(svc *usecase.Services) {
	const interval = time.Second / 30
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	last := time.Now()
	for now := range ticker.C {
		dt := now.Sub(last).Seconds()
		last = now
		svc.RunTick(dt)
	}
}

func resolveSessionPath(path string) string {
	if _, err := os.Stat(path); err == nil {
		return path
	}
	alt := "../" + path
	if _, err := os.Stat(alt); err == nil {
		return alt
	}
	return path
}

func runRegistryHeartbeat(registry port.RegistryClient, instanceID, wsURL string) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if err := registry.Heartbeat(instanceID); err != nil {
			log.Printf("registry heartbeat: %v", err)
			if regErr := registry.Register(instanceID, wsURL); regErr != nil {
				log.Printf("registry re-register: %v", regErr)
			}
		}
	}
}
