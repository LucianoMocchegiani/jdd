package usecase_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/memory"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/infrastructure/wshub"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/usecase"
)

func TestKiShieldInputCreatesObjectAndAbsorbsFrontHit(t *testing.T) {
	store:=memory.NewSessionStore();session:=store.GetOrCreate("block",1);_,defender:=session.AddPlayer("defender",0,0,0,0,0);_,attacker:=session.AddPlayer("attacker",0,-2,0,0,0)
	catalog:=inputAttackCatalog{"escudo_de_ki":{InputIntent:"attack_ki_shield",ControlType:"one_shot",Cooldown:10*time.Second,ManaCost:10,Defense:&port.DefenseProfile{Shape:"cone",Absorption:50,Duration:5*time.Second,AngleDegrees:120}}}
	svc:=&usecase.Services{Sessions:store,Combat:catalog,Hub:wshub.NewHub()}
	response,ok:=svc.HandleInput(usecase.InputPayload{BloqueID:"block",EcoID:1,PlayerID:"defender",Seq:1,Intents:map[string]bool{"attack_ki_shield":true}})
	var ack struct{Type string `json:"type"`;ActionID string `json:"action_id"`}
	if !ok||json.Unmarshal([]byte(response),&ack)!=nil||ack.Type!="swing_queued"||ack.ActionID!="escudo_de_ki"{t.Fatalf("shield was not accepted: %q",response)}
	if defender.Mana!=90||len(session.KiShieldStates(time.Now()))!=1{t.Fatalf("mana=%v shields=%v",defender.Mana,session.KiShieldStates(time.Now()))}
	svc.HandleSwingResult(usecase.SwingResultEvent{BloqueID:"block",EcoID:1,PlayerID:"attacker",EntityID:int(attacker.EntityID),TargetPlayerID:"defender",TargetEntityID:int(defender.EntityID),EntityDamage:30})
	if defender.Health!=100||session.KiShieldStates(time.Now())["defender"]!=20{t.Fatalf("front damage not absorbed: health=%v shields=%v",defender.Health,session.KiShieldStates(time.Now()))}
}
