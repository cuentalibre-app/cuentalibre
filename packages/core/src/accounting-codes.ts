/*
 * Ledger account numbers for exporting the books to accounting software (otros programas, the
 * gestoría's program…). An account is a PGC prefix ("430" clients, "572" banks…) followed by
 * a code padded with zeros, so every number has the same length: 430 + 12 → 43000012.
 */

export const MIN_ACCOUNT_DIGITS = 6;
export const MAX_ACCOUNT_DIGITS = 12;

const DIGITS = /^\d+$/;

/** Digits left for the code after the prefix. */
export const accountCodeLength = (prefix: string, digits: number) => Math.max(0, digits - prefix.trim().length);

/** Why a prefix can't be used, or undefined when it's fine. */
export function prefixError(prefix: string, digits: number): string | undefined {
  const p = prefix.trim();
  if (!p) return "Indica el prefijo.";
  if (!DIGITS.test(p)) return "Solo números.";
  if (p.length >= digits) return `Debe tener menos de ${digits} dígitos.`;
  return undefined;
}

/** Why a code can't be used with that prefix, or undefined when it's fine. An empty code is valid (all zeros). */
export function codeError(prefix: string, code: string, digits: number): string | undefined {
  const c = code.trim();
  if (!c) return undefined;
  if (!DIGITS.test(c)) return "Solo números.";
  const room = accountCodeLength(prefix, digits);
  if (c.replace(/^0+/, "").length > room) return `No cabe: quedan ${room} dígitos tras el prefijo.`;
  return undefined;
}

/**
 * The full account number: prefix plus the code padded (or trimmed of leading zeros) to fill
 * `digits`. Null when the prefix or code is invalid.
 */
export function ledgerAccountNumber(prefix: string, code: string, digits: number): string | null {
  if (prefixError(prefix, digits) || codeError(prefix, code, digits)) return null;
  const p = prefix.trim();
  const room = accountCodeLength(p, digits);
  const significant = code.trim().replace(/^0+/, "");
  return p + significant.padStart(room, "0");
}
