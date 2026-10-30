import type { Strings } from "../i18n";
import { isDecimalString } from "./format";
import type { CalculationProfile } from "./types";

/** Dezimalfelder, die im Profil-Editor und bei der Kalkulation gelten. */
export type ProfileDecimalKey =
  | "fail_rate_percent"
  | "tax_rate_percent"
  | "margin_percent"
  | "handling_fee"
  | "energy_price_per_kwh"
  | "power_level_percent"
  | "print_time_factor";

export const PROFILE_DECIMAL_KEYS: readonly ProfileDecimalKey[] = [
  "fail_rate_percent",
  "tax_rate_percent",
  "margin_percent",
  "handling_fee",
  "energy_price_per_kwh",
  "power_level_percent",
  "print_time_factor",
];

const PERCENT_KEYS: ReadonlySet<ProfileDecimalKey> = new Set([
  "fail_rate_percent",
  "tax_rate_percent",
  "power_level_percent",
]);

/** Anzeigename eines Profil-Dezimalfeldes. */
export function profileDecimalLabel(key: ProfileDecimalKey, t: Strings): string {
  switch (key) {
    case "fail_rate_percent":
      return t.profiles.failRate;
    case "tax_rate_percent":
      return t.profiles.tax;
    case "margin_percent":
      return t.profiles.margin;
    case "handling_fee":
      return t.profiles.handlingFee;
    case "energy_price_per_kwh":
      return t.profiles.energyPrice;
    case "power_level_percent":
      return t.profiles.powerLevel;
    case "print_time_factor":
      return t.profiles.printTimeFactor;
  }
}

/**
 * Prüft ein einzelnes Profil-Dezimalfeld.
 *
 * Die Regeln liegen bewusst an einer Stelle, damit Profil-Editor und
 * Kalkulationsansicht nicht auseinanderlaufen. Der Rechenkern validiert
 * dieselben Grenzen zusätzlich verbindlich in Rust.
 */
export function profileDecimalError(
  key: ProfileDecimalKey,
  value: string,
  t: Strings,
): string | null {
  if (!isDecimalString(value)) return t.validation.decimal(profileDecimalLabel(key, t));
  const numeric = Number(value);
  if (PERCENT_KEYS.has(key) && (numeric < 0 || numeric > 100)) {
    return t.validation.percent(profileDecimalLabel(key, t));
  }
  if (key !== "margin_percent" && numeric < 0) {
    return t.validation.nonNegative(profileDecimalLabel(key, t));
  }
  return null;
}

/** Prüft alle Profil-Dezimalfelder und liefert Fehler nach Feldname. */
export function validateProfileDecimals(
  profile: CalculationProfile,
  t: Strings,
): Partial<Record<ProfileDecimalKey, string>> {
  const errors: Partial<Record<ProfileDecimalKey, string>> = {};
  for (const key of PROFILE_DECIMAL_KEYS) {
    const error = profileDecimalError(key, profile[key], t);
    if (error) errors[key] = error;
  }
  return errors;
}
