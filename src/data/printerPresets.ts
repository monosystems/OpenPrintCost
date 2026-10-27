import type { Printer } from "../api/types";

/**
 * Vorlagen für gängige Drucker — Referenzwerte in US-Dollar.
 *
 * Die Preise sind Dollar-Referenzwerte (US-Listenpreis). Der Nutzer
 * trägt den tatsächlichen Kaufpreis in seiner Wunschwährung ein — es
 * findet keine Umrechnung statt.
 *
 * Erweitern: ein Objekt anhängen (`key` eindeutig, Mengen als
 * `DecimalString` mit Punkt). Keine Migration nötig, Anlegen läuft
 * über den normalen `savePrinter`-Pfad mit neuer ID.
 */
export interface PrinterPreset extends Omit<Printer, "id" | "properties"> {
  key: string;
}

export const PRINTER_PRESETS: PrinterPreset[] = [
  {
    key: "prusa-mk4s",
    model: "MK4S",
    manufacturer: "Prusa Research",
    process: "fdm",
    material_family: "filament",
    power_watts: "240",
    build_width_mm: "250",
    build_depth_mm: "210",
    build_height_mm: "220",
    purchase_price: "799",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },
  {
    key: "bambulab-p1s",
    model: "P1S",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "1000",
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "599",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },
  {
    key: "creality-ender-3-v3",
    model: "Ender 3 V3",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: "350",
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "250",
    purchase_price: "299",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },
];

/** Anzeigename einer Vorlage: "Hersteller Modell". */
export function presetLabel(preset: PrinterPreset): string {
  return `${preset.manufacturer ?? ""} ${preset.model}`.trim();
}

/**
 * Dollar-Referenzpreis einer Vorlage (`$799`).
 *
 * Der Wert dient nur als Orientierung. Beim Anwenden einer Vorlage wird er
 * bewusst **nicht** in das Kaufpreisfeld übernommen — der Nutzer trägt dort
 * den tatsächlichen Kaufpreis in seiner eigenen Währung ein.
 */
export function referencePriceLabel(preset: PrinterPreset): string {
  return `$${preset.purchase_price}`;
}

export interface PresetGroup {
  manufacturer: string;
  presets: PrinterPreset[];
}

/**
 * Presets gruppiert nach Hersteller, jeweils sortiert A–Z.
 * Hersteller ohne Namen landen unter "–".
 */
export function groupPresetsByManufacturer(
  presets: ReadonlyArray<PrinterPreset> = PRINTER_PRESETS,
): PresetGroup[] {
  const byManufacturer = new Map<string, PrinterPreset[]>();
  for (const preset of presets) {
    const key = preset.manufacturer?.trim() || "–";
    const list = byManufacturer.get(key);
    if (list) list.push(preset);
    else byManufacturer.set(key, [preset]);
  }
  return [...byManufacturer.entries()]
    .map(([manufacturer, list]) => ({
      manufacturer,
      presets: [...list].sort((a, b) => a.model.localeCompare(b.model)),
    }))
    .sort((a, b) => a.manufacturer.localeCompare(b.manufacturer));
}
