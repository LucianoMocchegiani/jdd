	impact := profile.Impact
	queryReach := int(math.Ceil(impact.Reach)) + 1
	candidates, err := s.Repo.GetParticlesNear(ctx, cmd.BloqueID, cmd.PosX, cmd.PosY, cmd.PosZ, queryReach)
	if err != nil {
		return SwingOutcome{}, err
	}
	origin := jdcombat.Point{X: cmd.PosX, Y: cmd.PosY, Z: cmd.PosZ}
	impacts := make([]swingImpact, 0, len(candidates)+len(cmd.Targets))
	for i := range candidates {
		p := candidates[i]
		if isSolidParticle(p) && jdcombat.HitsWorldCellWithWidth(origin, cmd.Yaw, p.CeldaX, p.CeldaY, p.CeldaZ, impact.Reach, impact.Width) {
			impacts = append(impacts, swingImpact{forward: jdcombat.ForwardDistance(origin, cmd.Yaw, float64(p.CeldaX), float64(p.CeldaY)), particle: &p})
		}
	}
	for i := range cmd.Targets {
		target := cmd.Targets[i]
		if target.PlayerID == "" || target.PlayerID == cmd.PlayerID || !jdcombat.HitsPlayerWithWidth(origin, cmd.Yaw, jdcombat.Point{X: target.X, Y: target.Y, Z: target.Z}, impact.Reach, impact.Width) {
			continue
		}
		impacts = append(impacts, swingImpact{forward: jdcombat.ForwardDistance(origin, cmd.Yaw, target.X, target.Y), player: &target})
	}
