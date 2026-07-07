/**
 * @file Contrato base de componentes ECS.
 *
 * Los componentes son **solo datos**; la lógica vive en {@link System}.
 */

/**
 * Clase base de todos los componentes del mundo ECS.
 *
 * Cada subclase define un `type` estable usado como clave en {@link World}.
 * Ejemplo futuro: `ContactComponent`, `PositionComponent`.
 */
export abstract class Component {
  /**
   * Identificador único del tipo de componente en el almacén del mundo.
   *
   * Sobrescribir si se renombra la clase pero debe conservarse compatibilidad
   * con datos serializados o saves.
   */
  abstract readonly type: string;
}
