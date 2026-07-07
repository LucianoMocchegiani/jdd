// Tests: Casos de uso REST y combate.
package usecase

import (
	"math"
	"testing"

	"github.com/juego-de-dioses/jd/cmd/persistence-api/internal/domain"
)

func TestComputeWorldSizeEmpty(t *testing.T) {
	got := computeWorldSize(nil)
	if got.AnchoTotal != 1000 || got.AltoTotal != 1000 {
		t.Fatalf("defaults: %+v", got)
	}
}

func TestComputeWorldSizeTwoBlocks(t *testing.T) {
	got := computeWorldSize([]domain.BloqueBounds{
		{OrigenX: 0, OrigenY: 0, AnchoMetros: 100, AltoMetros: 50},
		{OrigenX: 100, OrigenY: 0, AnchoMetros: 100, AltoMetros: 50},
	})
	if got.MinX != 0 || got.MaxX != 200 || got.MinY != 0 || got.MaxY != 50 {
		t.Fatalf("bounds: min/max got %+v", got)
	}
	if got.AnchoTotal != 200 || got.AltoTotal != 50 {
		t.Fatalf("size: %+v", got)
	}
	wantRadio := math.Sqrt(100*100 + 25*25)
	if math.Abs(got.RadioMundo-wantRadio) > 1e-9 {
		t.Fatalf("radio got %v want %v", got.RadioMundo, wantRadio)
	}
}
