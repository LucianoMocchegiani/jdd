func (m *TerrainPushManager) IsReady(connID uint64) bool {
	state, ok := m.get(connID)
	if !ok {
		return false
	}
	_, _, pending := state.Snapshot()
	return pending == 0
}
