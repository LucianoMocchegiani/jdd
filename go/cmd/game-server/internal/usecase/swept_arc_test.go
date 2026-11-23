package usecase

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
)

func TestSnapshotSweptArcTargetsOnlyTheFrontSector(t *testing.T) {
	sess := memory.NewSessionStore().GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 0, 0, 0)
	sess.AddPlayer("front", 0, -2, 0, 0, 0)
	sess.AddPlayer("side", 3, 0, 0, 0, 0)
	profile := &port.CombatProfile{Impact: &port.DamageProfile{Shape: "swept_arc", Reach: 2, SweepDegrees: 120, Damage: 15}}
	targets := snapshotSwingTargets(sess, port.SwingCommand{PlayerID: "caster", Yaw: 0}, profile)
	if len(targets) != 1 || targets[0].PlayerID != "front" { t.Fatalf("unexpected swept-arc targets: %+v", targets) }
}
