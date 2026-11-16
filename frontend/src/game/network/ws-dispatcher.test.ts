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
