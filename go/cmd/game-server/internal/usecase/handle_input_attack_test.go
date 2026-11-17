package usecase_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

type inputAttackCatalog map[string]*port.CombatProfile

func (c inputAttackCatalog) Get(id string) *port.CombatProfile { return c[id] }
func (c inputAttackCatalog) GetByInputIntent(intent string) (string, *port.CombatProfile) {
	for id, profile := range c {
		if profile.InputIntent == intent {
			return id, profile
		}
	}
	return "", nil
}

func TestHandleInputStartsCombatOnlyOnNewAttackIntent(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
	publisher := &swingPublisher{}
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: publisher,
		Combat: inputAttackCatalog{
			"attack": {InputIntent: "attack_light", Cooldown: 500 * time.Millisecond, Impact: &port.DamageProfile{Reach: 2, Damage: 15}},
		},
	}

	input := usecase.InputPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", Seq: 1, Intents: map[string]bool{"attack_light": true}}
	response, ok := svc.HandleInput(input)
	if !ok || publisher.calls != 1 {
		t.Fatalf("first attack input was not accepted: ok=%t calls=%d", ok, publisher.calls)
	}
	var ack struct {
		Type      string `json:"type"`
		ActionID  string `json:"action_id"`
		ActionSeq int    `json:"action_seq"`
	}
	if err := json.Unmarshal([]byte(response), &ack); err != nil || ack.Type != "swing_queued" || ack.ActionID != "attack" || ack.ActionSeq != 1 {
		t.Fatalf("accepted attack ack=%q, err=%v", response, err)
	}
	input.Seq = 2
	if _, ok := svc.HandleInput(input); !ok || publisher.calls != 1 {
		t.Fatalf("held attack was repeated: ok=%t calls=%d", ok, publisher.calls)
	}
	player, _ := sess.GetPlayer("player")
	if player.ActionID != "attack" || player.ActionSeq != 1 {
		t.Fatalf("accepted input did not register server action: %q/%d", player.ActionID, player.ActionSeq)
	}
}

func TestHandleInputDoesNotCastAreaAbilityWithoutTarget(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 1, 1.25, 0)
	publisher := &swingPublisher{}
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: publisher,
		Combat: inputAttackCatalog{
			"orbe_explosivo": {InputIntent: "target_orbe", Cooldown: time.Second, ManaCost: 20, Area: &port.AreaProfile{Range: 18, Radius: 3, Damage: 20, Effect: "orb"}},
		},
	}
	input := usecase.InputPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", Seq: 1, Intents: map[string]bool{"target_orbe": true}}
	if _, ok := svc.HandleInput(input); !ok || publisher.calls != 0 {
		t.Fatalf("area intent without an explicit target was cast: ok=%t calls=%d", ok, publisher.calls)
	}
	player, _ := sess.GetPlayer("player")
	if player.Mana != 100 || player.ActionSeq != 0 {
		t.Fatalf("untargeted area intent changed player state: mana=%v actionSeq=%d", player.Mana, player.ActionSeq)
	}
}
