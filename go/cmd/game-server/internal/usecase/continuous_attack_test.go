package usecase

import (
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
)

type continuousAttackCatalog map[string]*port.CombatProfile

func (c continuousAttackCatalog) Get(id string) *port.CombatProfile { return c[id] }

type continuousAttackPublisher struct { commands []port.SwingCommand }
func (p *continuousAttackPublisher) PublishSwing(cmd port.SwingCommand) error { p.commands = append(p.commands, cmd); return nil }

func TestContinuousAttackChargesAndPublishesOncePerDamageInterval(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 0, 0, 0, 0, 0)
	sess.AddPlayer("target", 0, -2, 0, 0, 0)
	sess.AddPlayer("outside", 1.2, -2, 0, 0, 0)
	profile := &port.CombatProfile{
		InputIntent: "continuous_attack", ControlType: "sustained", ManaCostPerSecond: 5,
		DamageInterval: time.Second, Impact: &port.DamageProfile{Reach: 28, Width: 0.55, Damage: 5},
	}
	publisher := &continuousAttackPublisher{}
	svc := &Services{Combat: continuousAttackCatalog{"rayo_de_ki": profile}, SwingPub: publisher}
	sess.UpdatePlayer("player", func(p *entity.Player) {
		p.InputSeq = 3
		p.Intents["continuous_attack"] = true
		p.ContinuousAttackID = "rayo_de_ki"
	})
	for i := 0; i < 2; i++ {
		sess.ForEachPlayer(func(p *entity.Player) {
			if p.ID != "player" { return }
			cmd, ok := svc.advanceContinuousAttack(sess, p, 0.5, time.Now())
			if i == 0 && ok { t.Fatal("beam pulsed before the damage interval") }
			if i == 1 && ok {
				cmd.Targets = snapshotContinuousAttackTargets(sess, cmd, profile)
				publisher.PublishSwing(cmd)
			}
		})
	}
	player, _ := sess.GetPlayer("player")
	if player.Mana != 95 || len(publisher.commands) != 1 || publisher.commands[0].ActionID != "rayo_de_ki" || publisher.commands[0].Seq <= 0 || len(publisher.commands[0].Targets) != 1 || publisher.commands[0].Targets[0].PlayerID != "target" {
		t.Fatalf("mana=%v commands=%+v", player.Mana, publisher.commands)
	}
	sess.UpdatePlayer("player", func(p *entity.Player) { delete(p.Intents, "continuous_attack") })
	sess.ForEachPlayer(func(p *entity.Player) {
		if p.ID == "player" {
			if _, ok := svc.advanceContinuousAttack(sess, p, 0.5, time.Now()); ok { t.Fatal("released beam produced another pulse") }
		}
	})
	player, _ = sess.GetPlayer("player")
	if player.ContinuousAttackID != "" || len(publisher.commands) != 1 {
		t.Fatalf("released beam remained active or pulsed: %+v", player)
	}
}
