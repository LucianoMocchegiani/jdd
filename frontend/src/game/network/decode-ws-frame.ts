/**
 * @file Decodificación de frames WS (JSON texto o MsgPack binario para player_state).
 */

import { decode } from '@msgpack/msgpack';
import type { RealtimeInboundMessage } from '@/types/world-events';
import { parseInboundMessage } from '@/game/network/ws-dispatcher';

function normalizeMsgpackValue(value: unknown): unknown {
  if (value instanceof Map) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      out[String(k)] = normalizeMsgpackValue(v);
    }
    return out;
  }
  if (Array.isArray(value)) {
    return value.map(normalizeMsgpackValue);
  }
  return value;
}

/** Parsea un frame WS entrante (texto JSON o binario MsgPack). */
export function decodeWsFrame(data: string | ArrayBuffer): RealtimeInboundMessage | null {
  try {
    if (typeof data === 'string') {
      return parseInboundMessage(JSON.parse(data));
    }
    const raw = normalizeMsgpackValue(decode(new Uint8Array(data)));
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }
    return parseInboundMessage(raw as Record<string, unknown>);
  } catch {
    return null;
  }
}
