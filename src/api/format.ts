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

  return formatScaled(digits, scale);
}

/**
 * Sums non-negative decimal strings exactly and returns a plain decimal
 * string without trailing zeros. Returns `null` if any value is not a plain
 * decimal number.
 *
 * Used for physical quantities that must not pass through `Number`, for
 * example the total filament volume of a G-code import.
 */
export function sumDecimalStrings(values: ReadonlyArray<string>): string | null {
  let digits = 0n;
  let scale = 0;
  for (const value of values) {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
    if (!match) return null;
    const fraction = match[2] ?? "";
    if (fraction.length > scale) {
      digits *= 10n ** BigInt(fraction.length - scale);
      scale = fraction.length;
    }
    digits += BigInt(match[1] + fraction) * 10n ** BigInt(scale - fraction.length);
  }

  return formatScaled(digits, scale);
}

/**
 * Sums signed decimal strings exactly and returns a plain decimal string
 * without trailing zeros. Returns `null` if any value is not a plain decimal
 * number.
 *
 * Money amounts must stay exact on the way to the display; `Number` would
 * introduce binary rounding errors before the final rounding step.
 */
export function sumSignedDecimalStrings(values: ReadonlyArray<string>): string | null {
  let digits = 0n;
  let scale = 0;
  const parsed: Array<{ sign: bigint; integer: string; fraction: string }> = [];
  for (const value of values) {
    const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
    if (!match) return null;
    parsed.push({
      sign: match[1] === "-" ? -1n : 1n,
      integer: match[2] ?? "0",
      fraction: match[3] ?? "",
    });
    scale = Math.max(scale, (match[3] ?? "").length);
  }

  for (const entry of parsed) {
    const fraction = entry.fraction.padEnd(scale, "0");
    digits += entry.sign * BigInt(entry.integer + fraction);
  }

  return formatScaled(digits, scale);
}

/** Renders an integer plus scale as a plain decimal string. */
function formatScaled(digits: bigint, scale: number): string {
  const negative = digits < 0n;
  let result = (negative ? -digits : digits).toString();
  if (scale > 0) {
    result = result.padStart(scale + 1, "0");
    const fraction = result.slice(-scale).replace(/0+$/, "");
    const integer = result.slice(0, -scale);
    result = fraction.length > 0 ? `${integer}.${fraction}` : integer;
  }
  return negative ? `-${result}` : result;
}
