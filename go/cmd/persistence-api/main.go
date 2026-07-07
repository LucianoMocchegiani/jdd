// Package main — API REST de persistencia: bloques, partículas y combate.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/config"
	httpdelivery "github.com/juego-de-dioses/jd/cmd/persistence-api/internal/delivery/http"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/infrastructure/combat"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/infrastructure/postgres"
	redisinfra "github.com/juego-de-dioses/jd/cmd/persistence-api/internal/infrastructure/redis"
	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/usecase"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL required")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()

	opt, err := goredis.ParseURL(cfg.RedisURL)
	if err != nil {
		log.Fatal(err)
	}
	rdb := goredis.NewClient(opt)

	catalogPath := resolvePath(cfg.CombatCatalogPath)
	catalog, err := combat.LoadCatalog(catalogPath)
	if err != nil {
		log.Fatalf("combat catalog: %v", err)
	}

	repo := postgres.NewParticleRepository(pool)
	bloqueRepo := postgres.NewBloqueRepository(pool)
	bloqueSvc := usecase.NewBloqueService(bloqueRepo)
	events := redisinfra.NewEventPublisher(rdb)
	rateLimit := redisinfra.NewDestroyRateLimiter(rdb, cfg.MaxDestroyPerBlockPerSec)
	swingSvc := usecase.NewSwingService(repo, catalog, events, rateLimit)

	consumer := redisinfra.NewSwingConsumer(rdb, func(ctx context.Context, payload string) error {
		var cmd usecase.SwingCommand
		if err := json.Unmarshal([]byte(payload), &cmd); err != nil {
			return err
		}
		out, err := swingSvc.ApplySwing(ctx, cmd)
		if err != nil {
			log.Printf("apply swing: %v", err)
			return err
		}
		if !out.OK && out.Error != "" {
			log.Printf("swing rejected: %s action=%s", out.Error, cmd.ActionID)
		}
		return nil
	})

	go func() {
		if err := consumer.Run(ctx); err != nil && err != context.Canceled {
			log.Printf("swing consumer: %v", err)
		}
	}()

	mux := http.NewServeMux()
	httpdelivery.MountHealth(mux)
	httpdelivery.MountAPIRoot(mux)
	httpdelivery.NewBloquesHandler(bloqueSvc).Mount(mux)

	srv := &http.Server{Addr: cfg.ListenAddr(), Handler: mux}
	go func() {
		log.Printf("persistence-api listening on %s", cfg.ListenAddr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	cancel()
	shCtx, shCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shCancel()
	_ = srv.Shutdown(shCtx)
}

func resolvePath(path string) string {
	if _, err := os.Stat(path); err == nil {
		return path
	}
	alt := "../" + path
	if _, err := os.Stat(alt); err == nil {
		return alt
	}
	return path
}
