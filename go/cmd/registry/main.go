// Package main — Registry de ecos y game-servers (matchmaking por bloque).
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

	"github.com/juego-de-dioses/jd/cmd/registry/internal/config"
	httpdelivery "github.com/juego-de-dioses/jd/cmd/registry/internal/delivery/http"
	redisinfra "github.com/juego-de-dioses/jd/cmd/registry/internal/infrastructure/redis"
	"github.com/juego-de-dioses/jd/cmd/registry/internal/usecase"
)

func main() {
	cfg := config.Load()

	opt, err := goredis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatalf("redis url: %v", err)
	}
	rdb := goredis.NewClient(opt)
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	store := redisinfra.NewEcoStore(rdb, cfg.PlayerMappingTTL, cfg.GameHeartbeatTTL, cfg.EcoSpawnThreshold)
	registerUC := usecase.NewRegisterGameServer(store)
	resolveUC := usecase.NewResolvePlayer(store, cfg.MaxPlayersPerEco)
	releaseUC := usecase.NewReleasePlayer(store)
	syncUC := usecase.NewSyncEco(store, cfg.MaxPlayersPerEco)

	mux := http.NewServeMux()
	httpdelivery.NewServer(registerUC, resolveUC, releaseUC, syncUC).Mount(mux)

	srv := &http.Server{Addr: cfg.ListenAddr(), Handler: mux}
	go func() {
		log.Printf("registry listening on %s", cfg.ListenAddr())
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
