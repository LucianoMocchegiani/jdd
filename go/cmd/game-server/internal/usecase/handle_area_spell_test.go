package usecase_test

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
)

type failingSwingPublisher struct{}

func (failingSwingPublisher) PublishSwing(port.SwingCommand) error { return errors.New("publisher unavailable") }

func targetedOrbProfile() *port.CombatProfile {
	return &port.CombatProfile{
		Cooldown: time.Second, ManaCost: 20,
		Targeting: &port.TargetingProfile{Type: "ground_point", Range: 18, Effect: "orb"},
		Impact: &port.DamageProfile{Shape: "radial", Origin: "target", Radius: 3, Damage: 20},
	}
}

func TestAreaSpellValidatesGroundAndDamagesPlayersAuthoritatively(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 0, 0, 0)
	sess.AddPlayer("inside", 2, 0, 0, 0, 0)
	sess.AddPlayer("outside", 5, 0, 0, 0, 0)
	sess.SolidGrid.MergeSolidCells([]string{cellkey.Format(0, 0, 0)})
	publisher := &swingPublisher{}
	svc := &usecase.Services{Sessions: store, SwingPub: publisher, Combat: combatCatalog{"orbe_explosivo": targetedOrbProfile()}}
	response, failed := svc.HandleAreaSpell(usecase.AreaSpellPayload{BloqueID: "block", EcoID: 1, PlayerID: "caster", Seq: 1, ActionID: "orbe_explosivo", Target: port.AreaTarget{X: 0, Y: 0, Z: 0.45}})
	if failed {
		t.Fatal("valid target rejected")
	}
	inside, _ := sess.GetPlayer("inside")
	outside, _ := sess.GetPlayer("outside")
	caster, _ := sess.GetPlayer("caster")
	var ack struct {
		Type      string `json:"type"`
		Seq       int    `json:"seq"`
		ActionID  string `json:"action_id"`
		ActionSeq int    `json:"action_seq"`
	}
	if err := json.Unmarshal([]byte(response), &ack); err != nil || ack.Type != "swing_queued" || ack.Seq != 1 || ack.ActionID != "orbe_explosivo" || ack.ActionSeq != 1 {
		t.Fatalf("accepted area cast ack=%q, err=%v", response, err)
	}
	if inside.Health != 80 || outside.Health != 100 || caster.Mana != 80 || publisher.calls != 1 || publisher.command.AreaTarget == nil {
		t.Fatalf("inside=%v outside=%v mana=%v published=%+v", inside.Health, outside.Health, caster.Mana, publisher.command)
	}
}

func TestAreaSpellEnqueueFailureRefundsManaAndReservation(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 0, 0, 0)
	sess.SolidGrid.MergeSolidCells([]string{cellkey.Format(0, 0, 0)})
	svc := &usecase.Services{Sessions: store, SwingPub: failingSwingPublisher{}, Combat: combatCatalog{"orbe_explosivo": targetedOrbProfile()}}
	input := usecase.AreaSpellPayload{BloqueID: "block", EcoID: 1, PlayerID: "caster", Seq: 1, ActionID: "orbe_explosivo", Target: port.AreaTarget{X: 0, Y: 0, Z: 0.45}}
	if _, failed := svc.HandleAreaSpell(input); !failed {
		t.Fatal("failed enqueue was accepted")
	}
	caster, _ := sess.GetPlayer("caster")
	if caster.Mana != caster.MaxMana || caster.ActionSeq != 0 {
		t.Fatalf("failed enqueue changed mana or action state: mana=%v actionSeq=%d", caster.Mana, caster.ActionSeq)
	}
	svc.SwingPub = &swingPublisher{}
	if _, failed := svc.HandleAreaSpell(input); failed {
		t.Fatal("failed enqueue did not release the sequence and cooldown reservation")
	}
}

func TestAreaSpellRejectsUnvalidatedGround(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 0, 0, 0)
	publisher := &swingPublisher{}
	profile := &port.CombatProfile{
		Cooldown: time.Second, Targeting: &port.TargetingProfile{Type: "ground_point", Range: 18, Effect: "thunder"},
		Impact: &port.DamageProfile{Shape: "radial", Origin: "target", Radius: 2, Damage: 25},
	}
	svc := &usecase.Services{Sessions: store, SwingPub: publisher, Combat: combatCatalog{"trueno": profile}}
	if _, failed := svc.HandleAreaSpell(usecase.AreaSpellPayload{BloqueID: "block", EcoID: 1, PlayerID: "caster", Seq: 1, ActionID: "trueno", Target: port.AreaTarget{X: 1, Y: 1, Z: 1}}); !failed || publisher.calls != 0 {
		t.Fatal("target without server-known solid ground was accepted")
	}
}
