package entity

import (
	"testing"

	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
	jdmedium "github.com/juego-de-dioses/jd/pkg/jd/medium"
)

func TestAdvanceProjectilesDamagesPlayerAndStops(t *testing.T) {
	sess := NewBlockSession("block", 1)
	sess.AddPlayer("attacker", 0, 0, 0, 0, 0)
	sess.AddPlayer("target", 0, -3, 0, 0, 0)
	pose := SwingReservation{X: 0, Y: 0, Z: 0, Yaw: 0}
	if !sess.SpawnProjectile("attacker", "kamehameha", pose, 18, 28, 30, 0.55, 0) { t.Fatal("projectile should spawn") }
	var states []ProjectileState
	for i := 0; i < 10; i++ { states = sess.AdvanceProjectiles(1.0/30); if len(states)>0&&!states[len(states)-1].Active{break} }
	target, _ := sess.GetPlayer("target")
	if target.Health != 70 || len(states)==0 || states[len(states)-1].Active { t.Fatalf("expected one hit and stopped projectile; health=%v states=%+v",target.Health,states) }
}

func TestAdvanceProjectilesStopsAtSolidCell(t *testing.T) {
	sess := NewBlockSession("block", 1)
	sess.AddPlayer("attacker", 0, 0, 0, 0, 0)
	sess.AddPlayer("target", 0, -5, 0, 0, 0)
	sess.SolidGrid.MergeSolidCells([]string{cellkey.Format(0,-3,1)})
	sess.SolidGrid.MergeContactParticles([]jdmedium.Particle{{ID:"stone",X:0,Y:-3,Z:1,Name:"stone",Physics:"solido"}})
	pose := SwingReservation{X:0,Y:0,Z:0,Yaw:0,EntityID:1,Seq:1}
	if !sess.SpawnProjectile("attacker","kamehameha",pose,18,28,30,0.55,0){t.Fatal("projectile should spawn")}
	states:=sess.AdvanceProjectiles(0.1); target,_:=sess.GetPlayer("target")
	if target.Health!=100||len(states)!=1||states[0].Active||states[0].ParticleID!="stone"||states[0].ParticleX!=0||states[0].ParticleY!=-3||states[0].ParticleZ!=1{t.Fatalf("solid should stop projectile and identify its particle; health=%v states=%+v",target.Health,states)}
	states=sess.AdvanceProjectiles(0.1);if len(states)!=1||states[0].ParticleID!="stone"{t.Fatalf("unacknowledged hit should be retried: %+v",states)}
	sess.AcknowledgeProjectileParticleHit(states[0].ID);if states=sess.AdvanceProjectiles(0.1);len(states)!=0{t.Fatalf("acknowledged hit should be removed: %+v",states)}
}
