/**
 * @file Contratos del Action Registry (fichas declarativas).
 *
 * Cada {@link ActionDefinition} es una **habilidad** en diseño (`correr`, `atacar`, `venom_strike`):
 * intent + `when` + `movement` / `impact` / `appearance`. Sin capa `SkillDefinition` paralela.
 */

import type { ConditionApplyRef } from '@/types/condition';
import type { Medium } from '@/types/medium';

/** Slot de exclusión entre acciones simultáneas. */
export type ActionSlot =
  | 'constant_displacements'
  | 'impulse_displacements'
  | 'body_actions'
  | 'full_body_action';

/** Sostenida (correr) vs disparo (saltar). */
export type ActionType = 'sustained' | 'one_shot';

/**
 * Filtros de contexto para `control.when` (fase 5+: `medium`; fase 8: `conditions`).
 *
 * **No duplicar bloqueos de debuff:** si `stunned` ya tiene `effects.blockActionIds`,
 * el resolver las niega con la condición activa; no hace falta `when.not.conditions: ['stunned']`
 * en cada acción. Usar `when.conditions` para requisitos positivos (ej. solo con `combo_window`).
 */
export interface ActionWhen {
  medium?: Medium | Medium[];
  /** Requisito: todas deben estar activas (buff ventana, stance, etc.). */
  conditions?: readonly string[];
  not?: {
    medium?: Medium | Medium[];
    /** Denegar si alguna está activa; preferir `blockActionIds` en la ficha de la condición. */
    conditions?: readonly string[];
  };
}

/** Bloque `movement` de la ficha. */
export interface ActionMovement {
  /** Multiplicador sobre {@link baseMoveSpeedCells} del perfil de medio. */
  speedMultiplier?: number;
  impulseZ?: number;
  preserveVelocityXY?: boolean;
}

/**
 * Interrupciones entre fichas (fase 6).
 * @see Ideas/habilidades/borrador.md — `control.interrupt`
 */
export interface ActionInterrupt {
  /** Acciones que no pueden arrancar mientras esta está activa. */
  blocks?: readonly string[];
  /** Solo estas acciones pueden reemplazar la activa. */
  canBeInterruptedBy?: readonly string[];
}

/** Bloque `control`. */
export interface ActionControl {
  inputIntent: string;
  slot: ActionSlot;
  type: ActionType;
  when?: ActionWhen;
  /** Fase 6: resolver + validación al arranque. */
  interrupt?: ActionInterrupt;
}

/** Bloque `appearance` (fase 6: catálogo + tint hasta mixer GLB). */
export interface ActionAppearance {
  state?: string;
  clip?: string;
}

/** Daño al mundo desde la ficha activa. */
export interface ActionWorldDamage {
  reach: number;
  /** Daño bruto 0–100 para el API; default 15. */
  damage?: number;
}

/** Bloque `impact`. */
export interface ActionImpact {
  worldDamage?: ActionWorldDamage;
  /** Aplica instancias de condición al impactar (ids en condition registry). */
  applyConditions?: readonly ConditionApplyRef[];
}

/**
 * Definición completa de una acción registrada.
 */
export interface ActionDefinition {
  id: string;
  /**
   * Texto para humanos (diseño, IDE, docs). El motor no lo interpreta en runtime.
   */
  description?: string;
  control: ActionControl;
  movement?: ActionMovement;
  appearance?: ActionAppearance;
  impact?: ActionImpact;
}
