package entity

import (
	"math"
)

func (s *BlockSession) SpendSwingMana(playerID string, seq int, cost float64) bool {
	if cost < 0 || math.IsNaN(cost) || math.IsInf(cost, 0) {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.Players[playerID]
	if p == nil || p.lastSwingSeq != seq || p.Mana < cost {
		return false
	}
	p.Mana -= cost
	return true
}

func (s *BlockSession) CancelSwingAndRefundMana(playerID string, reservation SwingReservation, cost float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.Players[playerID]; p != nil && p.lastSwingSeq == reservation.Seq {
		p.lastSwingSeq, p.lastSwingAt = reservation.previousSeq, reservation.previousAt
		p.Mana = math.Min(p.MaxMana, p.Mana+cost)
	}
}
