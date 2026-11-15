	seq := sess.ServerTick + 1
	if seq <= p.ContinuousAttackSeq { seq = p.ContinuousAttackSeq + 1 }
	p.ContinuousAttackSeq = seq
