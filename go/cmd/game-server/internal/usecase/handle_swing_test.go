// Tests: Casos de uso: join, tick, input, terreno y destrucción.
package usecase_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

type swingPublisher struct {
	command port.SwingCommand
	calls   int
}

func (p *swingPublisher) PublishSwing(cmd port.SwingCommand) error {
	p.command = cmd
	p.calls++
	return nil
}

type combatCatalog map[string]*port.CombatProfile

func (c combatCatalog) Get(id string) *port.CombatProfile { return c[id] }

func TestHandleSwingUsesAuthoritativePoseAndQueuesPlayerCandidates(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
	sess.AddPlayer("target", 1.1, 3.4, 5, 0, 0)
	publisher := &swingPublisher{}
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: publisher,
		Combat: combatCatalog{"attack": {
			Cooldown: 500 * time.Millisecond,
			Impact:   &port.DamageProfile{Reach: 2, Damage: 15},
		}},
	}

	response, failed := svc.HandleSwing(usecase.SwingPayload{
		BloqueID: "block", EcoID: 1, PlayerID: "player", ActionID: "attack", Seq: 1,
	})
	if failed {
		t.Fatalf("swing rejected: %s", response)
	}
	if publisher.command.PosX != 3 || publisher.command.PosY != 4 || publisher.command.PosZ != 5 || publisher.command.Yaw != 1.25 {
		t.Fatalf("swing used non-authoritative pose: %+v", publisher.command)
	}
	if len(publisher.command.Targets) != 1 || publisher.command.Targets[0].PlayerID != "target" {
		t.Fatalf("swing did not snapshot the target candidate: %+v", publisher.command.Targets)
	}
	player, _ := sess.GetPlayer("player")
	if !player.InCombat(time.Now()) || time.Until(player.InCombatUntil) > 6*time.Second {
		t.Fatalf("accepted attack did not apply six-second combat state: %+v", player.InCombatUntil)
	}
	target, _ := sess.GetPlayer("target")
	if target.Health != 100 {
		t.Fatalf("entity damage should wait for the shared resolver, got health %v", target.Health)
	}
	var ack map[string]interface{}
	if err := json.Unmarshal([]byte(response), &ack); err != nil || ack["type"] != "swing_queued" {
		t.Fatalf("unexpected acknowledgement: %s", response)
	}

	_, failed = svc.HandleSwing(usecase.SwingPayload{
		BloqueID: "block", EcoID: 1, PlayerID: "player", ActionID: "attack", Seq: 1,
	})
	if !failed || publisher.calls != 1 {
		t.Fatal("duplicate swing should not be published")
	}
}
