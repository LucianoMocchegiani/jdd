func TestHandleInputStartsNewOneShotActionIntents(t *testing.T) {
	for _, tc := range []struct {
		intent, actionID string
		profile           *port.CombatProfile
	}{
		{"attack_heavy", "golpe_pesado", &port.CombatProfile{InputIntent: "attack_heavy", Cooldown: 1200 * time.Millisecond, Impact: &port.DamageProfile{Shape: "swept_arc", Origin: "caster", Reach: 2.5, SweepDegrees: 120, Damage: 25}}},
		{"attack_quick_projectile", "esfera_rapida", &port.CombatProfile{InputIntent: "attack_quick_projectile", Cooldown: 1200 * time.Millisecond, ManaCost: 10, Impact: &port.DamageProfile{Shape: "projectile", Origin: "caster", Reach: 18, Speed: 30, Radius: 0.35, Damage: 18}}},
	} {
		t.Run(tc.actionID, func(t *testing.T) {
			store := memory.NewSessionStore()
			sess := store.GetOrCreate("block", 1)
			sess.AddPlayer("player", 3, 4, 5, 1.25, 0)
			publisher := &swingPublisher{}
			svc := &usecase.Services{Sessions: store, SwingPub: publisher, Combat: inputAttackCatalog{tc.actionID: tc.profile}}
			response, ok := svc.HandleInput(usecase.InputPayload{BloqueID: "block", EcoID: 1, PlayerID: "player", Seq: 1, Intents: map[string]bool{tc.intent: true}})
			if !ok { t.Fatalf("input rejected: %s", response) }
			player, _ := sess.GetPlayer("player")
			if player.ActionID != tc.actionID || player.ActionSeq != 1 { t.Fatalf("action=%q seq=%d", player.ActionID, player.ActionSeq) }
			if tc.profile.ManaCost > 0 && player.Mana != 100-tc.profile.ManaCost { t.Fatalf("mana=%v", player.Mana) }
		})
	}
}
