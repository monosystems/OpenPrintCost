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

/**
 * Multiplies non-negative decimal strings exactly and returns a plain decimal
 * string without trailing zeros. Returns `null` if any value is not a plain
 * decimal number.
 */
export function multiplyDecimalStrings(values: ReadonlyArray<string>): string | null {
  let digits = 1n;
  let scale = 0;
  for (const value of values) {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
    if (!match) return null;
    const fraction = match[2] ?? "";
    digits *= BigInt(match[1] + fraction);
    scale += fraction.length;
  }

  let result = digits.toString();
  if (scale > 0) {
    result = result.padStart(scale + 1, "0");
    const fraction = result.slice(-scale).replace(/0+$/, "");
    const integer = result.slice(0, -scale);
    result = fraction.length > 0 ? `${integer}.${fraction}` : integer;
  }
  return result;
}
