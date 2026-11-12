package usecase_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

type projectileSwingPublisher struct{}
func (projectileSwingPublisher) PublishSwing(port.SwingCommand) error { return nil }

func TestHandleSwingSpawnsConfiguredProjectileWithoutPersistencePublisher(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
	svc := &usecase.Services{
		Sessions: store,
		SwingPub: projectileSwingPublisher{},
		Combat: combatCatalog{"kamehameha": {
			Cooldown: 3*time.Second,
			Projectile: &port.ProjectileProfile{Speed:18,Range:28,Damage:30,Radius:0.55,Delay:time.Second},
		}},
	}
	response, failed := svc.HandleSwing(usecase.SwingPayload{BloqueID:"block",EcoID:1,PlayerID:"player",ActionID:"kamehameha",Seq:1})
	if failed { t.Fatalf("projectile action rejected: %s",response) }
	var ack map[string]interface{}
	if err:=json.Unmarshal([]byte(response),&ack);err!=nil||ack["type"]!="swing_queued"{t.Fatalf("unexpected acknowledgement: %s",response)}
	_,failed=svc.HandleSwing(usecase.SwingPayload{BloqueID:"block",EcoID:1,PlayerID:"player",ActionID:"kamehameha",Seq:2})
	if !failed{t.Fatal("projectile should be rejected during cooldown")}
}
