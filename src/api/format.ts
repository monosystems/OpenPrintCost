import type { Locale } from "../i18n";

/**
 * Display formatting: decimal strings become locale-grouped numbers.
 *
 * Inputs and transports stay strings; only display formatting happens here.
 * `Intl.NumberFormat` only understands `number` — values are converted to
 * `Number` for that. This is display only and never touches exact amounts.
 */

const numberLocales: Record<Locale, string> = { en: "en-US", de: "de-DE" };

/** Formats a decimal string with exactly 2 decimals (money). */
export function formatMoney(value: string, locale: Locale = "en"): string {
  return formatDecimal(value, 2, undefined, locale);
}

/** Formats a decimal string with up to 3 decimals (quantities). */
export function formatQuantity(value: string, locale: Locale = "en"): string {
  return formatDecimal(value, 0, 3, locale);
}

function formatDecimal(value: string, min: number, max?: number, locale: Locale = "en"): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat(numberLocales[locale], {
    minimumFractionDigits: min,
    maximumFractionDigits: max ?? min,
  }).format(numeric);
}

/** Checks whether a string is a valid decimal number (dot separator). */
export function isDecimalString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}
