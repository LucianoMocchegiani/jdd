/**
 * @file Buffer circular de inputs WS enviados (para replay tras reconciliación).
 */

import type { PendingInput } from '@/types/reconciliation';

const DEFAULT_CAPACITY = 64;

/** Export `InputHistory` — input history. */
export class InputHistory {
  private readonly buffer: PendingInput[] = [];

  constructor(private readonly capacity = DEFAULT_CAPACITY) {}

  push(input: PendingInput): void {
    this.buffer.push(input);
    while (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }

  /** Elimina entradas con `seq <= ackedSeq`. */
  dropThrough(ackedSeq: number): void {
    while (this.buffer.length > 0 && this.buffer[0]!.seq <= ackedSeq) {
      this.buffer.shift();
    }
  }

  /** Inputs con `seq` estrictamente mayor que `ackedSeq`, en orden de envío. */
  after(ackedSeq: number): PendingInput[] {
    return this.buffer.filter((entry) => entry.seq > ackedSeq);
  }

  get pendingCount(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer.length = 0;
  }
}
