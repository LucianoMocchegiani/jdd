/** Declaraciones para imports JSON desde `@shared/` (shared/game-data). */
declare module '@shared/*.json' {
  const value: Record<string, unknown>;
  export default value;
}
