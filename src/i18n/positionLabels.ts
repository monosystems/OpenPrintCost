import type { Strings } from "./de";

/**
 * Übersetzt die vom Rechenkern gelieferten Systemlabels.
 *
 * Die Labels sind stabile deutsche Schlüssel aus `opc-core`; die eigentlichen
 * Übersetzungen liegen zentral in `Strings.positionLabels`.
 */
export const POSITION_LABEL_KEYS: Record<
  string,
  keyof Strings["positionLabels"]
> = {
  "Materialkosten": "materialCosts",
  "Materialkosten (Fehlerrate)": "materialCostsFail",
  "Maschinenkosten": "machineCosts",
  "Maschinenkosten (Fehlerrate)": "machineCostsFail",
  "Energiekosten": "energyCosts",
  "Energiekosten (Fehlerrate)": "energyCostsFail",
  "Düsenverschleiß": "nozzleWear",
  "Druckplattenverschleiß": "plateWear",
  "Materialwechsel": "materialChange",
  "Handlungspauschale": "handlingFee",
  "Gewinnmarge": "margin",
  "Steuer": "tax",
  "Verkaufspreis": "sellingPrice",
};

export function localizePositionLabel(label: string, t: Strings): string {
  const key = POSITION_LABEL_KEYS[label];
  return key ? t.positionLabels[key] : label;
}
