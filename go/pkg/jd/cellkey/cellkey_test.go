// Tests: Claves de celda estables para mapas y Redis.
package cellkey_test

import (
	"testing"

	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
)

func TestFormatParse(t *testing.T) {
	key := cellkey.Format(10, -5, 3)
	x, y, z, err := cellkey.Parse(key)
	if err != nil || x != 10 || y != -5 || z != 3 {
		t.Fatalf("roundtrip failed: %v %d %d %d", err, x, y, z)
	}
}
