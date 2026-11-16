import { parseInboundMessage } from '@/game/network/ws-dispatcher';
import assert from 'node:assert/strict';
import test from 'node:test';

test('area spell messages reject unknown effects and non-finite coordinates', () => {
  assert.equal(parseInboundMessage({ type:'area_spell', action_id:'trueno', player_id:'p', effect:'thunder', x:1, y:2, z:3, radius:2 })?.type, 'area_spell');
  assert.equal(parseInboundMessage({ type:'area_spell', action_id:'trueno', player_id:'p', effect:'unknown', x:1, y:2, z:3, radius:2 }), null);
  assert.equal(parseInboundMessage({ type:'area_spell', action_id:'trueno', player_id:'p', effect:'orb', x:Infinity, y:2, z:3, radius:2 }), null);
});
