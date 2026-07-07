// CLI de seeds / worldgen (bloques de prueba).
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	goredis "github.com/redis/go-redis/v9"

	"github.com/juego-de-dioses/jd/pkg/jd/worldgen"
)

func main() {
	flag.Parse()
	args := flag.Args()
	if len(args) == 0 {
		args = []string{"lago"}
	}

	switch args[0] {
	case "lago":
		if err := runLago(); err != nil {
			log.Fatal(err)
		}
	default:
		fmt.Fprintf(os.Stderr, "seed desconocido: %q (uso: seed lago)\n", args[0])
		os.Exit(2)
	}
}

func runLago() error {
	dbURL := env("DATABASE_URL", "postgres://juegodioses:juegodioses123@localhost:5432/juego_dioses?sslmode=disable")
	redisURL := env("REDIS_URL", "redis://localhost:6379")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	log.Println("Sembrando Terreno Test 2 — Lago y Montaña (Go worldgen)...")
	start := time.Now()
	result, err := worldgen.SeedLagoMontana(ctx, pool)
	if err != nil {
		return err
	}
	log.Printf("Insert completado en %s", time.Since(start).Round(time.Second))
	result.LogSummary()

	opt, err := goredis.ParseURL(redisURL)
	if err != nil {
		return err
	}
	rdb := goredis.NewClient(opt)
	defer rdb.Close()

	if err := worldgen.PublishBlockSeeded(ctx, rdb, result.BloqueID, true); err != nil {
		return fmt.Errorf("BlockSeeded: %w", err)
	}
	log.Println("Evento world:block_seeded publicado (terrain-service invalidará caché)")
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
