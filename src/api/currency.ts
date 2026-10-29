import type { Locale } from "../i18n";
import { DEFAULT_CURRENCY } from "./types";

/** Wählbare Währungen (ISO 4217) — nur Anzeige-Symbol, keine Umrechnung. */
export const CURRENCY_OPTIONS = ["EUR", "USD", "CHF", "GBP", "PLN", "CZK"] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number];

/** Anzeigesymbol eines Währungscodes (USD → $, EUR → €, sonst Code/Symbol). */
export function currencySymbol(code: string | null | undefined): string {
  switch ((code ?? "").trim().toUpperCase()) {
    case "USD":
    case "":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
    case "CNY":
    case "RMB":
      return "¥";
    default:
      return (code ?? "").trim() || "$";
  }
}

/** Betrag mit Währungssymbol (Anzeige only, exakte Werte bleiben Strings). */
export function formatMoneyWithCurrency(
  formatMoney: (value: string, locale?: Locale) => string,
  value: string,
  currency: string | null | undefined,
  locale?: Locale,
): string {
  return `${formatMoney(value, locale)} ${currencySymbol(currency)}`;
}

/** Ersetzt das Kern-€ in Detailtexten durch das Anzeige-Symbol (reine Darstellung). */
export function localizeDetail(detail: string | null | undefined, symbol: string): string {
  if (!detail) return "";
  return symbol === "€" ? detail : detail.split("€").join(symbol);
}

/** Normalisiert auf einen bekannten Code, Fallback wie DEFAULT_CURRENCY. */
export function normalizeCurrency(code: string | null | undefined): string {
  const upper = (code ?? "").trim().toUpperCase();
  return (CURRENCY_OPTIONS as readonly string[]).includes(upper)
    ? upper
    : DEFAULT_CURRENCY;
}
