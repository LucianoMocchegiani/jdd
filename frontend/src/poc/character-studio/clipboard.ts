/**
 * Utilidad de portapapeles para export del panel.
 */

/**
 * Copia texto al portapapeles del navegador.
 * @returns `true` si tuvo éxito.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
