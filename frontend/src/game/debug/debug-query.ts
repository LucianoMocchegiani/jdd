/** Flags de `?debug=pos-sync` o `?debug=pos-sync,input-stats`. */
export function isDebugFlagEnabled(flag: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const raw = new URLSearchParams(window.location.search).get('debug') ?? '';
  return raw
    .split(',')
    .map((part) => part.trim())
    .includes(flag);
}
