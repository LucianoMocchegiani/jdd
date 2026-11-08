package usecase

import "testing"

func TestParseContactParticles(t *testing.T) {
	particles := parseContactParticles(`{"type":"terrain_chunk","particles":[{"x":1,"y":2,"z":3,"tipo_nombre":"agua","tipo_fisico":"liquido"}]}`)
	if len(particles) != 1 || particles[0].Name != "agua" || particles[0].Physics != "liquido" || particles[0].X != 1 || particles[0].Y != 2 || particles[0].Z != 3 {
		t.Fatalf("unexpected parsed terrain particles: %+v", particles)
	}
	if got := parseContactParticles(`{`); len(got) != 0 {
		t.Fatalf("malformed terrain should not add contact samples: %+v", got)
	}
}
