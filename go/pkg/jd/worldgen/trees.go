package worldgen

import (
	"math"
	"math/rand"
)

// TreeSpec parámetros de árbol (espejo simplificado de TreeTemplate Python).
type TreeSpec struct {
	Name          string
	GrosorTronco  int
	AlturaMin     int
	AlturaMax     int
	CopaTamano    int
	CopaNiveles   int
	RaizTamano    int
	RaizProfundidad int
}

var treeSpecs = []TreeSpec{
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Palmera", GrosorTronco: 1, AlturaMin: 12, AlturaMax: 16, CopaTamano: 3, CopaNiveles: 2, RaizTamano: 2, RaizProfundidad: 2},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
	{Name: "Paraíso", GrosorTronco: 2, AlturaMin: 15, AlturaMax: 20, CopaTamano: 4, CopaNiveles: 3, RaizTamano: 3, RaizProfundidad: 3},
}

type treeCell struct{ x, y, z int }

func (s TreeSpec) trunkXY(cx, cy int) [][2]int {
	out := make([][2]int, 0, s.GrosorTronco*s.GrosorTronco)
	off := s.GrosorTronco / 2
	for dx := -off; dx < s.GrosorTronco-off; dx++ {
		for dy := -off; dy < s.GrosorTronco-off; dy++ {
			out = append(out, [2]int{cx + dx, cy + dy})
		}
	}
	return out
}

func (s TreeSpec) crownCells(r *rand.Rand, cx, cy, zBase int) []treeCell {
	var out []treeCell
	for z := zBase; z < zBase+s.CopaNiveles; z++ {
		nivel := z - zBase
		densBase := 1.0 - float64(nivel)*0.15
		for dx := -s.CopaTamano; dx <= s.CopaTamano; dx++ {
			for dy := -s.CopaTamano; dy <= s.CopaTamano; dy++ {
				dist := math.Hypot(float64(dx), float64(dy))
				if dist > float64(s.CopaTamano) {
					continue
				}
				var dens float64
				switch {
				case dist <= 1:
					dens = 1.0
				case dist <= float64(s.CopaTamano)*0.5:
					dens = 0.9 * densBase
				default:
					dens = 0.7 * densBase
				}
				if r.Float64() <= dens {
					out = append(out, treeCell{cx + dx, cy + dy, z})
				}
			}
		}
	}
	return out
}

func (s TreeSpec) rootCells(r *rand.Rand, cx, cy, zSurf int) []treeCell {
	var out []treeCell
	for z := zSurf - s.RaizProfundidad; z < zSurf; z++ {
		grosor := max(1, s.GrosorTronco-(zSurf-z)/2)
		off := grosor / 2
		for dx := -off; dx < grosor-off; dx++ {
			for dy := -off; dy < grosor-off; dy++ {
				out = append(out, treeCell{cx + dx, cy + dy, z})
			}
		}
		if z >= zSurf-1 {
			continue
		}
		nRoots := 4 + r.Intn(3)
		for i := 0; i < nRoots; i++ {
			ang := 2 * math.Pi * float64(i) / float64(nRoots)
			for dist := 1; dist <= s.RaizTamano; dist++ {
				rx := cx + int(float64(dist)*math.Cos(ang))
				ry := cy + int(float64(dist)*math.Sin(ang))
				if dist <= s.RaizTamano/2 {
					out = append(out, treeCell{rx, ry, z})
				}
			}
		}
	}
	return out
}

func (s TreeSpec) emit(w *Writer, cat *Catalog, r *rand.Rand, cx, cy, zBase int) int {
	trunkH := s.AlturaMin + r.Intn(s.AlturaMax-s.AlturaMin+1)
	n := 0
	for _, c := range s.rootCells(r, cx, cy, zBase) {
		w.AddUpsert(cat.Madera, cat.Solido, c.x, c.y, c.z, 18)
		n++
	}
	trunk := s.trunkXY(cx, cy)
	for z := zBase; z < zBase+trunkH; z++ {
		for _, xy := range trunk {
			w.AddUpsert(cat.Madera, cat.Solido, xy[0], xy[1], z, 20)
			n++
		}
	}
	zCrown := zBase + trunkH
	for _, c := range s.crownCells(r, cx, cy, zCrown) {
		w.AddUpsert(cat.Hojas, cat.Solido, c.x, c.y, c.z, 22)
		n++
	}
	return n
}

func pickTreePositions(r *rand.Rand, maxX, maxY int, forbidden map[[2]int]struct{}, count int) [][2]int {
	const (
		marginCells   = 8
		minSpacing    = 16
		maxAttempts   = 1000
	)
	var out [][2]int
	for attempt := 0; len(out) < count && attempt < maxAttempts; attempt++ {
		x := marginCells + r.Intn(maxX-2*marginCells)
		y := marginCells + r.Intn(maxY-2*marginCells)
		if _, bad := forbidden[[2]int{x, y}]; bad {
			continue
		}
		ok := true
		for _, p := range out {
			dx := float64(x - p[0])
			dy := float64(y - p[1])
			if math.Hypot(dx, dy) < minSpacing {
				ok = false
				break
			}
		}
		if ok {
			out = append(out, [2]int{x, y})
		}
	}
	return out
}

func expandForbidden(forbidden map[[2]int]struct{}, cells map[[2]int]struct{}, margin int, maxX, maxY int) {
	for xy := range cells {
		for dx := -margin; dx <= margin; dx++ {
			for dy := -margin; dy <= margin; dy++ {
				nx, ny := xy[0]+dx, xy[1]+dy
				if nx >= 0 && nx < maxX && ny >= 0 && ny < maxY {
					forbidden[[2]int{nx, ny}] = struct{}{}
				}
			}
		}
	}
}
