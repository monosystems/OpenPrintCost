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

/** Anzeigenamen der Aufzählungen. */
export const labels = {
  process: { fdm: "FDM", sla: "SLA", "powder-bed": "Pulverbett" } as const,
  family: { filament: "Filament", resin: "Harz", powder: "Pulver" } as const,
  unit: { kg: "kg", g: "Gramm", lb: "Pfund (lb)", oz: "Unze (oz)" } as const,
  calculationType: {
    "per-hour": "pro Stunde",
    "per-piece": "pro Stück",
    "per-order": "pro Auftrag",
  } as const,
  timing: { before: "vor dem Druck", after: "nach dem Druck", other: "sonstiges" } as const,
  timeBasis: { "per-year": "pro Jahr", "per-month": "pro Monat" } as const,
};
