package entity

import "time"

type ActionSwingReservation struct {
	SwingReservation
	actionID           string
	previousActionAt   time.Time
	hadPreviousActionAt bool
}

// BeginActionSwing applies cooldown per ability while retaining player-wide sequence deduplication.
func (s *BlockSession) BeginActionSwing(playerID, actionID string, seq int, now time.Time, cooldown time.Duration, blockedMediums []string) (ActionSwingReservation, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p, ok := s.Players[playerID]
	if !ok || p.Health <= 0 || seq <= p.lastSwingSeq {
		return ActionSwingReservation{}, false
	}
	previousActionAt, hadPreviousActionAt := p.lastSwingAtByAction[actionID]
	if hadPreviousActionAt && now.Sub(previousActionAt) < cooldown {
		return ActionSwingReservation{}, false
	}
	for _, medium := range blockedMediums {
		if p.Medium == medium {
			return ActionSwingReservation{}, false
		}
	}
	reservation := SwingReservation{X: p.X, Y: p.Y, Z: p.Z, Yaw: p.Yaw, Pitch: p.Pitch, EntityID: p.EntityID, Seq: seq, previousSeq: p.lastSwingSeq, previousAt: p.lastSwingAt}
	p.lastSwingSeq, p.lastSwingAt = seq, now
	if p.lastSwingAtByAction == nil {
		p.lastSwingAtByAction = make(map[string]time.Time)
	}
	p.lastSwingAtByAction[actionID] = now
	return ActionSwingReservation{SwingReservation: reservation, actionID: actionID, previousActionAt: previousActionAt, hadPreviousActionAt: hadPreviousActionAt}, true
}

func (s *BlockSession) CancelActionSwing(playerID string, reservation ActionSwingReservation) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.Players[playerID]; p != nil && p.lastSwingSeq == reservation.Seq {
		p.lastSwingSeq, p.lastSwingAt = reservation.previousSeq, reservation.previousAt
		if reservation.hadPreviousActionAt {
			p.lastSwingAtByAction[reservation.actionID] = reservation.previousActionAt
		} else {
			delete(p.lastSwingAtByAction, reservation.actionID)
		}
	}
}

func (s *BlockSession) CancelActionSwingAndRefundMana(playerID string, reservation ActionSwingReservation, cost float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.Players[playerID]; p != nil && p.lastSwingSeq == reservation.Seq {
		p.lastSwingSeq, p.lastSwingAt = reservation.previousSeq, reservation.previousAt
		if reservation.hadPreviousActionAt {
			p.lastSwingAtByAction[reservation.actionID] = reservation.previousActionAt
		} else {
			delete(p.lastSwingAtByAction, reservation.actionID)
		}
		p.Mana = math.Min(p.MaxMana, p.Mana+cost)
	}
}
