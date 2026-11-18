import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInboundMessage } from './ws-dispatcher.ts';

test('parses successful swing acknowledgements and rejects invalid sequences', () => {
  assert.deepEqual(parseInboundMessage({
    type: 'swing_queued', seq: 4, action_seq: 2, entity_id: 7, action_id: 'kamehameha',
  }), { type: 'swing_queued', seq: 4, action_seq: 2, entity_id: 7, action_id: 'kamehameha' });
  assert.equal(parseInboundMessage({
    type: 'swing_queued', seq: 4, action_seq: Number.NaN, entity_id: 7, action_id: 'kamehameha',
  }), null);
});

test('parses the active sustained action for remote aura animation', () => {
  const parsed = parseInboundMessage({
    type: 'player_state', server_tick: 1, player_id: 'p', bloque_id: 'b',
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
    continuous_attack_active: true, continuous_action_id: 'aura_de_ki',
  });
  assert.equal(parsed?.type, 'player_state');
  if (parsed?.type === 'player_state') assert.equal(parsed.continuous_action_id, 'aura_de_ki');
});

test('rejects non-finite incoming coordinates', () => {
  assert.equal(parseInboundMessage({
    type: 'player_state', server_tick: 1, player_id: 'p', bloque_id: 'b',
    x: Number.NaN, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
  }), null);
});
