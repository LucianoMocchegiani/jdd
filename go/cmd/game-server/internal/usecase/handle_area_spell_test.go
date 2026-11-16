package usecase_test

import (
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
	"github.com/juego-de-dioses/jd/pkg/jd/cellkey"
)

func TestAreaSpellValidatesGroundAndDamagesPlayersAuthoritatively(t *testing.T) {
	store := memory.NewSessionStore()
	sess := store.GetOrCreate("block", 1)
	sess.AddPlayer("caster", 0, 0, 0, 0, 0)
	sess.AddPlayer("inside", 2, 0, 0, 0, 0)
	sess.AddPlayer("outside", 5, 0, 0, 0, 0)
	sess.SolidGrid.MergeSolidCells([]string{cellkey.Format(0, 0, 0)})
	publisher := &swingPublisher{}
	svc := &usecase.Services{Sessions:store, SwingPub:publisher, Combat:combatCatalog{"orbe_explosivo":{Cooldown:time.Second, ManaCost:20, Area:&port.AreaProfile{Range:18, Radius:3, Damage:20, Effect:"orb"}}}}
	if _, failed := svc.HandleAreaSpell(usecase.AreaSpellPayload{BloqueID:"block",EcoID:1,PlayerID:"caster",Seq:1,ActionID:"orbe_explosivo",Target:port.AreaTarget{X:0,Y:0,Z:0.45}}); failed { t.Fatal("valid target rejected") }
	inside,_:=sess.GetPlayer("inside"); outside,_:=sess.GetPlayer("outside"); caster,_:=sess.GetPlayer("caster")
	if inside.Health!=80||outside.Health!=100||caster.Mana!=80||publisher.calls!=1||publisher.command.AreaTarget==nil { t.Fatalf("inside=%v outside=%v mana=%v published=%+v",inside.Health,outside.Health,caster.Mana,publisher.command) }
}

func TestAreaSpellRejectsUnvalidatedGround(t *testing.T) {
	store:=memory.NewSessionStore(); sess:=store.GetOrCreate("block",1); sess.AddPlayer("caster",0,0,0,0,0)
	publisher:=&swingPublisher{};svc:=&usecase.Services{Sessions:store,SwingPub:publisher,Combat:combatCatalog{"trueno":{Cooldown:time.Second,Area:&port.AreaProfile{Range:18,Radius:2,Damage:25,Effect:"thunder"}}}}
	if _,failed:=svc.HandleAreaSpell(usecase.AreaSpellPayload{BloqueID:"block",EcoID:1,PlayerID:"caster",Seq:1,ActionID:"trueno",Target:port.AreaTarget{X:1,Y:1,Z:1}});!failed||publisher.calls!=0{t.Fatal("target without server-known solid ground was accepted")}
}
