/**
 * Symbol Utility Helpers
 * Ensures symbols are preserved as-is without forcing uppercase,
 * while allowing flexible, case-insensitive comparison and matching.
 */

export function normalizeSymbol(sym?: string | null): string {
  if (!sym) return '';
  return String(sym).trim();
}

/**
 * Case-insensitive comparison between two symbol strings.
 * Preserves each symbol's original casing while determining equality.
 */
export function symbolsMatch(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeSymbol(a).toLowerCase() === normalizeSymbol(b).toLowerCase();
}

/**
 * Find a symbol in a list of symbols or symbol objects by matching name case-insensitively,
 * returning the canonical symbol name as defined by the broker/package.
 */
export function findCanonicalSymbol<T extends { symbol: string } | string>(
  list: T[],
  target: string
): string {
  const normTarget = normalizeSymbol(target).toLowerCase();
  for (const item of list) {
    const sym = typeof item === 'string' ? item : item.symbol;
    if (sym.toLowerCase() === normTarget) {
      return sym;
    }
  }
  return normalizeSymbol(target);
}
