package worldgen

import (
	"context"
	"fmt"
	"math"
	"math/rand"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// LagoMontanaBlockName nombre del bloque de prueba.
	LagoMontanaBlockName = "Terreno Test 2 - Lago y Montaña"
	lagoSizeM            = 40.0
	lagoCellSize         = 0.25
	lagoProfMax          = -11
)

// LagoMontanaResult estadísticas del seed.
type LagoMontanaResult struct {
	BloqueID       string
	CellsX         int
	CellsY         int
	ParticleCount  int
	TreesPlaced    int
	TreeParticles  int
}

// SeedLagoMontana genera el mapa 40×40 m con lago, montaña y árboles.
func SeedLagoMontana(ctx context.Context, pool *pgxpool.Pool) (*LagoMontanaResult, error) {
	cat, err := LoadCatalog(ctx, pool)
	if err != nil {
		return nil, err
	}
	if err := DeleteBlockByName(ctx, pool, LagoMontanaBlockName); err != nil {
		return nil, err
	}
	bloqueID, err := CreateBlock(ctx, pool, LagoMontanaBlockName, lagoSizeM, lagoSizeM, lagoCellSize, lagoProfMax)
	if err != nil {
		return nil, err
	}

	maxX := int(lagoSizeM / lagoCellSize)
	maxY := maxX
	w := NewWriter(ctx, pool, bloqueID)
	terrainRNG := rand.New(rand.NewSource(1))

	// Capa límite (z = profundidad_maxima)
	for x := 0; x < maxX; x++ {
		for y := 0; y < maxY; y++ {
			w.Add(cat.Limite, cat.Solido, x, y, lagoProfMax, 0)
		}
	}

	// Piedra z=-11
	for x := 0; x < maxX; x++ {
		for y := 0; y < maxY; y++ {
			w.Add(cat.Piedra, cat.Solido, x, y, -11, 15)
		}
	}

	// Tierra z=-10..-1
	for x := 0; x < maxX; x++ {
		for y := 0; y < maxY; y++ {
			for z := -10; z <= -1; z++ {
				w.Add(cat.Tierra, cat.Solido, x, y, z, 18)
			}
		}
	}

	// Hierba z=0
	for x := 0; x < maxX; x++ {
		for y := 0; y < maxY; y++ {
			w.Add(cat.Hierba, cat.Solido, x, y, 0, 20)
		}
	}

	// Lago orgánico
	lagoRadio := int(10.0 / lagoCellSize)
	lagoCX := maxX / 3
	lagoCY := maxY / 2
	lagoArea := make(map[[2]int]struct{})
	for x := 0; x < maxX; x++ {
		for y := 0; y < maxY; y++ {
			dx := float64(x - lagoCX)
			dy := float64(y - lagoCY)
			distAdj := math.Hypot(dx*0.9, dy*1.1)
			radioEff := float64(lagoRadio) * (0.85 + terrainRNG.Float64()*0.15)
			if distAdj >= radioEff {
				continue
			}
			distNorm := distAdj / radioEff
			depthMax := int(10 * (1.0 - distNorm*0.4))
			if depthMax < 3 {
				depthMax = 3
			}
			for z := -depthMax + 1; z <= 0; z++ {
				w.AddUpsert(cat.Agua, cat.Liquido, x, y, z, 15)
				lagoArea[[2]int{x, y}] = struct{}{}
			}
		}
	}

	// Montaña
	montanaRadio := int(6.0 / lagoCellSize)
	montanaCX := maxX - 60
	montanaCY := maxY - 60
	montanaMaxH := 6
	montanaArea := make(map[[2]int]struct{})
	search := montanaRadio + 2
	for x := montanaCX - search; x <= montanaCX+search; x++ {
		for y := montanaCY - search; y <= montanaCY+search; y++ {
			if x < 0 || x >= maxX || y < 0 || y >= maxY {
				continue
			}
			dx := float64(x - montanaCX)
			dy := float64(y - montanaCY)
			dist := math.Hypot(dx, dy)
			radioEff := float64(montanaRadio) * (0.9 + terrainRNG.Float64()*0.1)
			if dist >= radioEff {
				continue
			}
			distNorm := dist / radioEff
			if radioEff > 0 {
				distNorm = dist / radioEff
			}
			factor := math.Max(0, 1.0-math.Pow(distNorm, 1.5))
			h := int(factor * float64(montanaMaxH))
			h += terrainRNG.Intn(3) - 1
			if h < 1 {
				h = 1
			}
			if h > montanaMaxH {
				h = montanaMaxH
			}
			montanaArea[[2]int{x, y}] = struct{}{}
			for z := 1; z <= h; z++ {
				var tipo string
				switch {
				case z <= 2:
					if terrainRNG.Float64() < 0.8 {
						tipo = cat.Tierra
					} else {
						tipo = cat.Piedra
					}
				case z <= 4:
					if terrainRNG.Float64() < 0.5 {
						tipo = cat.Tierra
					} else {
						tipo = cat.Piedra
					}
				default:
					if terrainRNG.Float64() < 0.2 {
						tipo = cat.Tierra
					} else {
						tipo = cat.Piedra
					}
				}
				w.AddUpsert(tipo, cat.Solido, x, y, z, 15)
			}
		}
	}

	if err := w.Flush(); err != nil {
		return nil, err
	}

	// Árboles (semilla fija como Python)
	treeRNG := rand.New(rand.NewSource(42))
	forbidden := make(map[[2]int]struct{})
	expandForbidden(forbidden, lagoArea, 8, maxX, maxY)
	expandForbidden(forbidden, montanaArea, 8, maxX, maxY)
	positions := pickTreePositions(treeRNG, maxX, maxY, forbidden, 10)
	treeParticles := 0
	for i, xy := range positions {
		spec := treeSpecs[i%len(treeSpecs)]
		treeParticles += spec.emit(w, cat, treeRNG, xy[0], xy[1], 0)
	}
	if err := w.Flush(); err != nil {
		return nil, err
	}

	total, err := CountParticles(ctx, pool, bloqueID)
	if err != nil {
		return nil, err
	}

	return &LagoMontanaResult{
		BloqueID:      bloqueID,
		CellsX:        maxX,
		CellsY:        maxY,
		ParticleCount: total,
		TreesPlaced:   len(positions),
		TreeParticles: treeParticles,
	}, nil
}

// LogSummary imprime resumen a stdout (CLI).
func (r *LagoMontanaResult) LogSummary() {
	fmt.Println("============================================================")
	fmt.Printf("Seed Lago y Montaña OK\n")
	fmt.Printf("Bloque ID: %s\n", r.BloqueID)
	fmt.Printf("Celdas: %dx%d (40m x 40m)\n", r.CellsX, r.CellsY)
	fmt.Printf("Partículas totales: %d\n", r.ParticleCount)
	fmt.Printf("Árboles: %d (~%d partículas de árbol)\n", r.TreesPlaced, r.TreeParticles)
	fmt.Println("Jugar: http://localhost:8080/?bloque=lago")
	fmt.Println("============================================================")
}
