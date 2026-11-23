  assert.equal(selectRemoteClip({ ...base, action_id: 'attack' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'golpe_pesado' }), 'attack');
  assert.equal(selectRemoteClip({ ...base, action_id: 'esfera_rapida' }), 'kamehameha');
  assert.equal(selectRemoteClip({ ...base, action_id: 'kamehameha' }), 'kamehameha');