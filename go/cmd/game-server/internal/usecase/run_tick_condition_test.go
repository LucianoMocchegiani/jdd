package usecase

import (
	"testing"

	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
)

func TestApplyConditionDamageReducesHealthAndClampsAtZero(t *testing.T) {
	player := &entity.Player{Health: 5}
	applyConditionDamage(player, 3)
	if player.Health != 2 || player.ConditionDamageTotal != 3 {
		t.Fatalf("after condition damage: health=%v total=%v", player.Health, player.ConditionDamageTotal)
	}
	applyConditionDamage(player, 4)
	if player.Health != 0 || player.ConditionDamageTotal != 7 {
		t.Fatalf("lethal condition damage: health=%v total=%v", player.Health, player.ConditionDamageTotal)
	}
}
