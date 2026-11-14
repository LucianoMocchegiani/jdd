		sess.ForEachPlayer(func(p *entity.Player) {
			p.RegenerateMana(deltaSec, now)
			systems.ResolvePlayerContact(p, sess.SolidGrid, s.SessionCfg, s.Medium)
			if s.Conditions != nil {
				p.ConditionDamageTotal += s.Conditions.Update(&p.Conditions, &p.LastContactParticle, &p.ConditionLastTickAt, p.DominantParticleName, now)
			}
			intents, speed := p.Intents, 1.0
			if s.Conditions != nil {
				intents = s.Conditions.FilterIntents(p.Conditions, intents)
				speed = s.Conditions.MovementSpeedMultiplier(p.Conditions)
			}
			systems.RunPlayerTickWithEffects(p, sess.SolidGrid, s.SessionCfg, s.Medium, deltaSec, intents, speed)
		})
