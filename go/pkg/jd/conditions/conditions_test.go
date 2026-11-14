package conditions

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestUpdateAppliesAndExpiresContactConditionsAndTicks(t *testing.T) {
	dir := t.TempDir()
	status := filepath.Join(dir, "status.json")
	elemental := filepath.Join(dir, "elemental.json")
	particles := filepath.Join(dir, "particles.json")
	write := func(path, data string) {
		t.Helper()
		if err := os.WriteFile(path, []byte(data), 0600); err != nil {
			t.Fatal(err)
		}
	}
	write(status, `{"conditions":[{"id":"burning","lifecycle":{"durationMs":1000},"effects":{"tick":{"intervalMs":500,"damage":4},"movement":{"speedMultiplier":0.5},"blockIntents":["jump"]}}]}`)
	write(elemental, `{"conditions":[]}`)
	write(particles, `{"typeOverrides":{"lava":{"conditions":{"onEnter":[{"conditionId":"burning","durationMs":1000}],"onStay":[{"conditionId":"burning","durationMs":1000}]}}}}`)
	catalog, err := Load(status, elemental, particles)
	if err != nil {
		t.Fatal(err)
	}
	active := []Instance{}
	lastContact := ""
	lastTicks := map[string]time.Time{}
	now := time.Unix(100, 0)
	if damage := catalog.Update(&active, &lastContact, &lastTicks, "lava", now); damage != 4 {
		t.Fatalf("first tick damage = %v, want 4", damage)
	}
	if len(active) != 1 || active[0].ConditionID != "burning" {
		t.Fatalf("contact condition not applied: %+v", active)
	}
	if !catalog.BlocksIntent(active, "jump") || catalog.MovementSpeedMultiplier(active) != 0.5 {
		t.Fatal("condition effects not resolved")
	}
	if damage := catalog.Update(&active, &lastContact, &lastTicks, "", now.Add(1001*time.Millisecond)); damage != 4 || len(active) != 0 {
		t.Fatalf("expired condition update = active:%+v damage:%v", active, damage)
	}
}
