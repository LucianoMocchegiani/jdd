package usecase_test

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

type projectileSwingPublisher struct{}

func (projectileSwingPublisher) PublishSwing(port.SwingCommand) error { return nil }

type failingSwingPublisher struct{}

func (failingSwingPublisher) PublishSwing(port.SwingCommand) error { return errors.New("queue unavailable") }

func TestHandleSwingSpendsConfiguredProjectileMana(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: projectileSwingPublisher{},
		Combat: combatCatalog{"kamehameha": {
			Cooldown: 3 * time.Second,
			ManaCost: 20,
			Projectile: &port.ProjectileProfile{Speed: 18, Range: 28, Damage: 30, Radius: 0.55, Delay: time.Second},
		}},
	}
	response, failed := svc.HandleSwing(usecase.SwingPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", ActionID: "kamehameha", Seq: 1})
	if failed {
		t.Fatalf("projectile action rejected: %s", response)
	}
	var ack map[string]interface{}
	if err := json.Unmarshal([]byte(response), &ack); err != nil || ack["type"] != "swing_queued" {
		t.Fatalf("unexpected acknowledgement: %s", response)
	}
	player, _ := sess.GetPlayer("player")
	if player.Mana != 80 {
		t.Fatalf("mana after projectile = %v, want 80", player.Mana)
	}
	_, failed = svc.HandleSwing(usecase.SwingPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", ActionID: "kamehameha", Seq: 2})
	if !failed {
		t.Fatal("projectile should be rejected during cooldown")
	}
}

func TestHandleSwingRejectsInsufficientManaWithoutConsumingCooldown(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
	sess.UpdatePlayer("player", func(p *entity.Player) { p.Mana = 19 })
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: projectileSwingPublisher{},
		Combat: combatCatalog{"kamehameha": {
			Cooldown: 3 * time.Second,
			ManaCost: 20,
			Projectile: &port.ProjectileProfile{Speed: 18, Range: 28, Damage: 30, Radius: 0.55, Delay: time.Second},
		}},
	}
	payload := usecase.SwingPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", ActionID: "kamehameha", Seq: 1}
	if _, failed := svc.HandleSwing(payload); !failed {
		t.Fatal("projectile should be rejected without enough mana")
	}
	sess.UpdatePlayer("player", func(p *entity.Player) { p.Mana = 20 })
	if _, failed := svc.HandleSwing(payload); failed {
		t.Fatal("rejected low-mana attempt should not consume sequence or cooldown")
	}
	player, _ := sess.GetPlayer("player")
	if player.Mana != 0 {
		t.Fatalf("mana after retry = %v, want 0", player.Mana)
	}
}

func TestHandleSwingFailureRefundsManaAndCooldown(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: failingSwingPublisher{},
		Combat: combatCatalog{"attack": {
			Cooldown: 3 * time.Second,
			ManaCost: 10,
			Impact: &port.DamageProfile{Reach: 2, Damage: 15},
		}},
	}
	payload := usecase.SwingPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", ActionID: "attack", Seq: 1}
	if _, failed := svc.HandleSwing(payload); !failed {
		t.Fatal("failed publisher should reject the swing")
	}
	player, _ := sess.GetPlayer("player")
	if player.Mana != 100 {
		t.Fatalf("mana after failed queue = %v, want 100", player.Mana)
	}
	svc.SwingPub = projectileSwingPublisher{}
	if _, failed := svc.HandleSwing(payload); failed {
		t.Fatal("failed queue should not consume sequence or cooldown")
	}
	player, _ = sess.GetPlayer("player")
	if player.Mana != 90 {
		t.Fatalf("mana after accepted retry = %v, want 90", player.Mana)
	}
}
