/**
 * Anzeigeformatierung: deutsche Zahlen mit Dezimalkomma.
 *
 * Eingaben und Transporte bleiben Strings; erst hier wird für die Anzeige
 * formatiert. `Intl.NumberFormat` versteht nur `number` — die Werte werden
 * dafür in `Number` umgewandelt. Das ist reine Anzeige und berührt die
 * exakten Beträge nicht.
 */

/** Formatiert einen Dezimal-String mit genau 2 Nachkommastellen (Geld). */
export function formatMoney(value: string): string {
  return formatDecimal(value, 2);
}

/** Formatiert einen Dezimal-String mit bis zu 4 Nachkommastellen (Mengen). */
export function formatQuantity(value: string): string {
  return formatDecimal(value, 4, 4);
}

function formatDecimal(value: string, min: number, max?: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: min,
    maximumFractionDigits: max ?? min,
  }).format(numeric);
}

/** Prüft, ob ein String eine gültige Dezimalzahl ist (Punkt als Trenner). */
export function isDecimalString(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

import { de } from "../i18n/de";

/**
 * Anzeigenamen der Aufzählungen — aus dem Wörterbuch, damit kein deutscher
 * Text in der Formatierungsschicht steht.
 */
export const labels = de.domain;
