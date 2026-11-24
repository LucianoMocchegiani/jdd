import assert from 'node:assert/strict';
import test from 'node:test';
import { hasNewAttackIntent, NetworkInputSender } from './input-sender.ts';

test('tracks all one-shot action edges together', () => {
  const wasActive = { attack_light: false, attack_heavy: false, attack_projectile: false, attack_quick_projectile: false, attack_shockwave: false, attack_ki_shield: false, attack_dodge: false };
  const packed = { attack_light: true, attack_heavy: true, attack_projectile: true, attack_quick_projectile: true, attack_shockwave: true, attack_ki_shield: true, attack_dodge: true } as const;
  assert.equal(hasNewAttackIntent(packed, wasActive), true);
  assert.deepEqual(wasActive, { attack_light: true, attack_heavy: true, attack_projectile: true, attack_quick_projectile: true, attack_shockwave: true, attack_ki_shield: true, attack_dodge: true });
  assert.equal(hasNewAttackIntent(packed, wasActive), false);
});

test('re-pressing any one-shot action after release creates a new edge', () => {
  const wasActive = { attack_light: false, attack_heavy: false, attack_projectile: false, attack_quick_projectile: false, attack_shockwave: false, attack_ki_shield: false, attack_dodge: false };
  for (const intent of ['attack_light', 'attack_heavy', 'attack_projectile', 'attack_quick_projectile', 'attack_shockwave', 'attack_ki_shield', 'attack_dodge'] as const) {
    assert.equal(hasNewAttackIntent({ [intent]: true }, wasActive), true);
    assert.equal(hasNewAttackIntent({}, wasActive), false);
  }
});

test('sends newly added one-shot intents in input packets', () => {
  const sent: Array<{ intents?: Record<string, true> }> = [];
  const client = { send: (command: { intents?: Record<string, true> }) => { sent.push(command); return true; } } as never;
  const sender = new NetworkInputSender(client, 'block', 'player');
  for (const intent of ['attack_heavy', 'attack_quick_projectile', 'attack_shockwave', 'attack_ki_shield', 'attack_dodge'] as const) {
    sender.tick(0, { [intent]: true }, 0);
    assert.deepEqual(sent.at(-1)?.intents, { [intent]: true });
  }
});

test('sends the held continuous radial shield intent', () => {
  const sent: Array<{ intents?: Record<string, true> }> = [];
  const client = { send: (command: { intents?: Record<string, true> }) => { sent.push(command); return true; } } as never;
  new NetworkInputSender(client, 'block', 'player').tick(1, { continuous_ki_shield: true }, 0);
  assert.deepEqual(sent[0]?.intents, { continuous_ki_shield: true });
});
