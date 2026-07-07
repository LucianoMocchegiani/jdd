/**
 * @file Contratos del condition registry (fase 8).
 *
 * **Plantilla** (`ConditionDefinition`): qué hace el estado (efectos, duración por defecto).
 * **Referencia** (`ConditionApplyRef`): puntero `{ conditionId }` usado desde **fichas de acción**
 * (`impact.applyConditions`), partículas o triggers ambientales — no duplica la ficha.
 *
 * En Ideas, “habilidad” = {@link ActionDefinition}; no hay registro `skills` aparte.
 *
 * @see `Ideas/habilidades/contact-y-particulas.md` — `medium` vs `conditions`
 */

import type { ActionMovement } from '@/types/action';

/**
 * Referencia a una ficha del registry para **aplicar** una instancia en runtime.
 *
 * Usada en `impact.applyConditions`, contacto de partícula, habilidades, eventos ambientales.
 */
export interface ConditionApplyRef {
  /** Id registrado en `game-data/conditions/`. */
  conditionId: string;
  /** Override de `lifecycle.durationMs` de la plantilla. */
  durationMs?: number;
  /** Stacks iniciales si la plantilla es apilable. */
  stacks?: number;
}

/** Duración y apilado por defecto de la plantilla. */
export interface ConditionLifecycle {
  /** Sin valor = hasta que un sistema la quite (ej. salir de lava + tick). */
  durationMs?: number;
  stackable?: boolean;
  maxStacks?: number;
}

/** Daño o pulso periódico mientras la instancia esté activa. */
export interface ConditionTickEffect {
  intervalMs: number;
  damage?: number;
}

/**
 * Efectos que el motor aplica mientras la condición está en `ConditionsComponent`.
 * (Opción B: datos en ficha, no `switch` por id en código.)
 */
export interface ConditionEffects {
  movement?: Pick<ActionMovement, 'speedMultiplier'>;
  /** Intents bloqueados (ej. `attack_light`). */
  blockIntents?: readonly string[];
  /**
   * Ids de {@link ActionDefinition} que no pueden ganar el resolver mientras esta condición esté activa.
   * Sustituye repetir `when.not.conditions` en cada ficha de acción.
   */
  blockActionIds?: readonly string[];
  tick?: ConditionTickEffect;
}

/** Export `ConditionAppearance` — condition appearance. */
export interface ConditionAppearance {
  tint?: number;
}

/**
 * Ficha declarativa de una condición (veneno, aturdimiento, quemadura…).
 */
export interface ConditionDefinition {
  id: string;
  /** Texto para humanos; ignorado en runtime. */
  description?: string;
  lifecycle?: ConditionLifecycle;
  effects?: ConditionEffects;
  appearance?: ConditionAppearance;
}

/**
 * Trigger ambiental futuro (temperatura, radiación…).
 * No sustituye `medium`; solo **aplica** condiciones cuando el umbral se cumple.
 */
export interface EnvironmentConditionTrigger {
  id: string;
  description?: string;
  when: {
    /** Ej. calor: `min: 45` → aplicar `burning` por encima de 45 °C. */
    temperatureC?: { min?: number; max?: number };
  };
  apply: readonly ConditionApplyRef[];
}
