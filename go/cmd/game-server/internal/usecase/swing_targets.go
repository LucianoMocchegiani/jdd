package usecase

import (
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/entity"
	"github.com/juego-de-dioses/jd/cmd/game-server/internal/domain/port"
	jdcombat "github.com/juego-de-dioses/jd/pkg/jd/combat"
)

func snapshotSwingTargets(sess *entity.BlockSession, cmd port.SwingCommand, profile *port.CombatProfile) []port.SwingTarget {
	origin := jdcombat.Point{X: cmd.PosX, Y: cmd.PosY, Z: cmd.PosZ}
	targets := make([]port.SwingTarget, 0)
	sess.ForEachPlayer(func(p *entity.Player) {
		if p.ID != cmd.PlayerID && p.Health > 0 && jdcombat.HitsPlayerWithWidth(origin, cmd.Yaw, jdcombat.Point{X: p.X, Y: p.Y, Z: p.Z}, profile.Impact.Reach, profile.Impact.Width) {
			targets = append(targets, port.SwingTarget{PlayerID: p.ID, EntityID: int(p.EntityID), X: p.X, Y: p.Y, Z: p.Z})
		}
	})
	return targets
}
