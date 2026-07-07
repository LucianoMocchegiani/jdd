/**
 * @file Intents de entrada (sin tags v1 tipo `isRunning`).
 */

import { Component } from '@/ecs/core';

/**
 * Intents activos este frame (`move_forward`, `jump`, …).
 */
export class InputComponent extends Component {
  readonly type = 'input';

  /** Map intentId → activo */
  intents: Record<string, boolean> = {};

  constructor() {
    super();
  }

  /** Reinicia todos los intents a `false`. */
  clear(): void {
    for (const key of Object.keys(this.intents)) {
      this.intents[key] = false;
    }
  }

  /**
   * Marca un intent como activo.
   */
  setIntent(id: string, active: boolean): void {
    this.intents[id] = active;
  }

  isActive(id: string): boolean {
    return this.intents[id] === true;
  }
}
