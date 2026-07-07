/**
 * @file Identidad estable del jugador por pestaña (Sprint B).
 *
 * Usado en `join_block.player_id` para que el servidor reconozca
 * reconexiones y emita `player_left` / `player_joined` coherentes.
 */

const STORAGE_KEY = 'jdg-v2-player-id';

/**
 * Devuelve un UUID persistente en `sessionStorage` (una por pestaña).
 */
export function getOrCreatePlayerId(): string {
  if (typeof sessionStorage === 'undefined') {
    return crypto.randomUUID();
  }
  let id = sessionStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
