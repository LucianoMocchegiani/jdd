import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInboundMessage } from './ws-dispatcher.ts';

test('parses successful swing acknowledgements and rejects invalid sequences', () => {
  assert.deepEqual(parseInboundMessage({ type: 'swing_queued', seq: 4, action_seq: 2, entity_id: 7, action_id: 'kamehameha' }),
    { type: 'swing_queued', seq: 4, action_seq: 2, entity_id: 7, action_id: 'kamehameha' });
  assert.equal(parseInboundMessage({ type: 'swing_queued', seq: 4, action_seq: Number.NaN, entity_id: 7, action_id: 'kamehameha' }), null);
});

test('parses continuous action identity and shield geometry for client feedback', () => {
  const parsed = parseInboundMessage({
    type: 'player_state', server_tick: 1, player_id: 'p', bloque_id: 'b', x: 0, y: 0, z: 0,
    vx: 0, vy: 0, vz: 0, yaw: 0, continuous_attack_active: true,
    continuous_action_id: 'escudo_radial_de_ki', shield_active: true, shield_remaining: 35, shield_shape: 'radial',
  });
  assert.equal(parsed?.type, 'player_state');
  if (parsed?.type === 'player_state') {
    assert.equal(parsed.continuous_action_id, 'escudo_radial_de_ki');
    assert.equal(parsed.shield_remaining, 35);
    assert.equal(parsed.shield_shape, 'radial');
  }
});

test('validates multi-player swing result targets', () => {
  const parsed = parseInboundMessage({
    type: 'swing_result', player_id: 'caster', action_id: 'aura_de_ki', seq: 1, entity_id: 1,
    hits: [], player_hits: [{ player_id: 'target', entity_id: 2, damage: 5 }, { player_id: 'invalid', entity_id: 0, damage: 5 }],
  });
  assert.equal(parsed?.type, 'swing_result');
  if (parsed?.type === 'swing_result') assert.deepEqual(parsed.player_hits, [{ player_id: 'target', entity_id: 2, damage: 5 }]);
});

test('rejects non-finite incoming coordinates', () => {
  assert.equal(parseInboundMessage({
    type: 'player_state', server_tick: 1, player_id: 'p', bloque_id: 'b', x: Number.NaN,
    y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0,
  }), null);
});
