package usecase

import "testing"

func TestSwingDedupIncludesActionAndRejectsExactDuplicate(t *testing.T) {
	svc := &SwingService{processed: make(map[string]struct{})}
	if !svc.rememberSwing("player", "attack", 1, 1) || svc.rememberSwing("player", "attack", 1, 1) {
		t.Fatal("exact duplicate swing was not rejected")
	}
	if !svc.rememberSwing("player", "rayo_de_ki", 1, 1) {
		t.Fatal("continuous pulse sharing an input sequence was mistaken for a duplicate attack")
	}
}
