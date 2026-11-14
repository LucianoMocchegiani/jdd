package entity

import (
	"time"
	jdconditions "github.com/juego-de-dioses/jd/pkg/jd/conditions"
)

func (p *Player) ActiveConditionIDs() []string { return jdconditions.IDs(p.Conditions) }

func (p *Player) ActiveConditionState(now time.Time) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(p.Conditions))
	for _, condition := range p.Conditions {
		var remaining interface{}
		if condition.ExpiresAt != nil { remaining = max(0, condition.ExpiresAt.Sub(now).Milliseconds()) }
		out = append(out, map[string]interface{}{"condition_id": condition.ConditionID, "stacks": condition.Stacks, "remaining_ms": remaining})
	}
	return out
}
