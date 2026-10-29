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
export interface PrinterPreset
  extends Omit<Printer, "id" | "properties" | "power_watts" | "purchase_price"> {
  key: string;
  /** `null` = kein belastbarer Durchschnittsverbrauch bekannt. */
  power_watts: Printer["power_watts"] | null;
  /** `null` = kein US-Listenpreis als Referenz bekannt. */
  purchase_price: Printer["purchase_price"] | null;
}

// power_watts:
// Typical average electrical power consumption during a PLA print.
// NOT rated/max/PSU power.
//
// null means:
// No sufficiently reliable average PLA printing consumption was found.
// Do not replace null with the printer's rated/max power.

export const PRINTER_PRESETS: PrinterPreset[] = [
  // ===========================================================================
  // Prusa Research
  // ===========================================================================

  {
    key: "prusa-mk4s",
    model: "MK4S",
    manufacturer: "Prusa Research",
    process: "fdm",
    material_family: "filament",
    power_watts: "80",
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
    key: "prusa-mini-plus",
    model: "MINI+",
    manufacturer: "Prusa Research",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "180",
    build_depth_mm: "180",
    build_height_mm: "180",
    purchase_price: null,
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "prusa-core-one-plus",
    model: "CORE One+",
    manufacturer: "Prusa Research",
    process: "fdm",
    material_family: "filament",
    power_watts: "90",
    build_width_mm: "250",
    build_depth_mm: "220",
    build_height_mm: "270",
    purchase_price: null,
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "prusa-core-one-l-plus",
    model: "CORE One L+",
    manufacturer: "Prusa Research",
    process: "fdm",
    material_family: "filament",
    power_watts: "90",
    build_width_mm: "300",
    build_depth_mm: "300",
    build_height_mm: "330",
    purchase_price: null,
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "prusa-xl-plus",
    model: "XL+",
    manufacturer: "Prusa Research",
    process: "fdm",
    material_family: "filament",

    // Toolhead configuration has a major influence.
    // Current multi-tool XL+ documentation states ~235 W while printing.
    power_watts: "235",

    build_width_mm: "360",
    build_depth_mm: "360",
    build_height_mm: "360",
    purchase_price: null,
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Bambu Lab
  // ===========================================================================

  {
    key: "bambulab-a1-mini",
    model: "A1 mini",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "80",
    build_width_mm: "180",
    build_depth_mm: "180",
    build_height_mm: "180",
    purchase_price: "319",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "bambulab-a1",
    model: "A1",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "95",
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "429",
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
    power_watts: "105",
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
    key: "bambulab-p2s",
    model: "P2S",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "200",
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "519",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "bambulab-x1-carbon",
    model: "X1 Carbon",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "105",
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "1349",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "bambulab-h2s",
    model: "H2S",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "191",
    build_width_mm: "340",
    build_depth_mm: "320",
    build_height_mm: "340",
    purchase_price: "1099",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "bambulab-h2d",
    model: "H2D",
    manufacturer: "Bambu Lab",
    process: "fdm",
    material_family: "filament",
    power_watts: "178",
    build_width_mm: "350",
    build_depth_mm: "320",
    build_height_mm: "325",
    purchase_price: "1549",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Creality
  // ===========================================================================

  {
    key: "creality-ender-3-v3-se",
    model: "Ender-3 V3 SE",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: "120",
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "250",
    purchase_price: "239",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-ender-3-v3-ke",
    model: "Ender-3 V3 KE",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: "160",
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "240",
    purchase_price: "299",
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
    power_watts: "124",
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "250",
    purchase_price: "299",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-ender-3-v3-plus",
    model: "Ender-3 V3 Plus",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "300",
    build_depth_mm: "300",
    build_height_mm: "330",
    purchase_price: null,
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-ender-5-max",
    model: "Ender-5 Max",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "400",
    build_depth_mm: "400",
    build_height_mm: "400",
    purchase_price: "899",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-k1c",
    model: "K1C",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",

    // Reviews report a broad ~150-250 W range,
    // but no sufficiently reliable single average.
    power_watts: null,

    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "250",
    purchase_price: "599",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-k1-max",
    model: "K1 Max",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: "175",
    build_width_mm: "300",
    build_depth_mm: "300",
    build_height_mm: "300",
    purchase_price: "859",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-k2",
    model: "K2",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "260",
    build_depth_mm: "260",
    build_height_mm: "260",
    purchase_price: "599",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-k2-pro",
    model: "K2 Pro",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: "151",
    build_width_mm: "300",
    build_depth_mm: "300",
    build_height_mm: "300",
    purchase_price: "899",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "creality-k2-plus",
    model: "K2 Plus",
    manufacturer: "Creality",
    process: "fdm",
    material_family: "filament",
    power_watts: "249",
    build_width_mm: "350",
    build_depth_mm: "350",
    build_height_mm: "350",
    purchase_price: "1499",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Anycubic
  // ===========================================================================

  {
    key: "anycubic-kobra-4",
    model: "Kobra 4",
    manufacturer: "Anycubic",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "260",
    build_depth_mm: "260",
    build_height_mm: "260",
    purchase_price: "379",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "anycubic-kobra-x",
    model: "Kobra X",
    manufacturer: "Anycubic",
    process: "fdm",
    material_family: "filament",
    power_watts: "121",
    build_width_mm: "260",
    build_depth_mm: "260",
    build_height_mm: "260",
    purchase_price: "589",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "anycubic-kobra-s1",
    model: "Kobra S1",
    manufacturer: "Anycubic",
    process: "fdm",
    material_family: "filament",

    // 136 W has been measured for the S1 Combo,
    // not cleanly for the standalone printer.
    power_watts: null,

    build_width_mm: "250",
    build_depth_mm: "250",
    build_height_mm: "250",
    purchase_price: "549",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "anycubic-kobra-s1-max",
    model: "Kobra S1 Max",
    manufacturer: "Anycubic",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "350",
    build_depth_mm: "350",
    build_height_mm: "350",
    purchase_price: "899",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "anycubic-kobra-3-v2",
    model: "Kobra 3 V2",
    manufacturer: "Anycubic",
    process: "fdm",
    material_family: "filament",

    // 180 W was measured on the Combo setup.
    // Standalone value is not sufficiently isolated.
    power_watts: null,

    build_width_mm: "255",
    build_depth_mm: "255",
    build_height_mm: "260",
    purchase_price: "499",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "anycubic-kobra-3-max",
    model: "Kobra 3 Max",
    manufacturer: "Anycubic",
    process: "fdm",
    material_family: "filament",

    // ~360 W measurement refers to an 8-color Combo setup.
    power_watts: null,

    build_width_mm: "420",
    build_depth_mm: "420",
    build_height_mm: "500",
    purchase_price: "699",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Elegoo
  // ===========================================================================

  {
    key: "elegoo-centauri-2",
    model: "Centauri 2",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "299",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "elegoo-centauri-carbon-2",
    model: "Centauri Carbon 2",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",
    power_watts: "115",
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "349",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "elegoo-neptune-4",
    model: "Neptune 4",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",
    power_watts: "200",
    build_width_mm: "225",
    build_depth_mm: "225",
    build_height_mm: "265",
    purchase_price: "249",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "elegoo-neptune-4-pro",
    model: "Neptune 4 Pro",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",

    // Measured values vary roughly 124-192 W depending on active bed zone.
    // No single robust average found.
    power_watts: null,

    build_width_mm: "225",
    build_depth_mm: "225",
    build_height_mm: "265",
    purchase_price: "299",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "elegoo-neptune-4-plus",
    model: "Neptune 4 Plus",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",

    // Measurements show roughly 115-250 W during PLA printing.
    power_watts: null,

    build_width_mm: "320",
    build_depth_mm: "320",
    build_height_mm: "385",
    purchase_price: "424",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "elegoo-neptune-4-max",
    model: "Neptune 4 Max",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",
    power_watts: "300",
    build_width_mm: "420",
    build_depth_mm: "420",
    build_height_mm: "480",
    purchase_price: "549",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "elegoo-orangestorm-giga",
    model: "OrangeStorm Giga",
    manufacturer: "Elegoo",
    process: "fdm",
    material_family: "filament",
    power_watts: "490",
    build_width_mm: "800",
    build_depth_mm: "800",
    build_height_mm: "1000",
    purchase_price: "3437",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Flashforge
  // ===========================================================================

  {
    key: "flashforge-adventurer-5m",
    model: "Adventurer 5M",
    manufacturer: "Flashforge",
    process: "fdm",
    material_family: "filament",
    power_watts: "130",
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "220",
    purchase_price: "399",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "flashforge-adventurer-5m-pro",
    model: "Adventurer 5M Pro",
    manufacturer: "Flashforge",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "220",
    purchase_price: "549",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "flashforge-ad5x",
    model: "AD5X",
    manufacturer: "Flashforge",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "220",
    purchase_price: "499",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "flashforge-creator-5",
    model: "Creator 5",
    manufacturer: "Flashforge",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "779",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "flashforge-creator-5-pro",
    model: "Creator 5 Pro",
    manufacturer: "Flashforge",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "256",
    build_depth_mm: "256",
    build_height_mm: "256",
    purchase_price: "929",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // QIDI Tech
  // ===========================================================================

  {
    key: "qidi-q2",
    model: "Q2",
    manufacturer: "QIDI Tech",
    process: "fdm",
    material_family: "filament",
    power_watts: "160",
    build_width_mm: "270",
    build_depth_mm: "270",
    build_height_mm: "256",
    purchase_price: "499",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "qidi-plus5",
    model: "Plus5",
    manufacturer: "QIDI Tech",
    process: "fdm",
    material_family: "filament",
    power_watts: "190",
    build_width_mm: "320",
    build_depth_mm: "320",
    build_height_mm: "300",
    purchase_price: "749",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "qidi-max4",
    model: "Max4",
    manufacturer: "QIDI Tech",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "390",
    build_depth_mm: "390",
    build_height_mm: "340",
    purchase_price: "1149",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Sovol
  // ===========================================================================

  {
    key: "sovol-sv06-ace",
    model: "SV06 ACE",
    manufacturer: "Sovol",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "220",
    build_depth_mm: "220",
    build_height_mm: "250",
    purchase_price: "299",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "sovol-sv08",
    model: "SV08",
    manufacturer: "Sovol",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "350",
    build_depth_mm: "350",
    build_height_mm: "345",
    purchase_price: "599",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Snapmaker
  // ===========================================================================

  {
    key: "snapmaker-u1",
    model: "U1",
    manufacturer: "Snapmaker",
    process: "fdm",
    material_family: "filament",

    // Snapmaker publishes comparative energy-use data and
    // 10-30 W additional consumption for parked toolheads,
    // but not a clean average PLA printer power value.
    power_watts: null,

    build_width_mm: "270",
    build_depth_mm: "270",
    build_height_mm: "270",
    purchase_price: null,
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  // ===========================================================================
  // Raise3D
  // ===========================================================================

  {
    key: "raise3d-pro3-hs",
    model: "Pro3 HS",
    manufacturer: "Raise3D",
    process: "fdm",
    material_family: "filament",
    power_watts: null,
    build_width_mm: "300",
    build_depth_mm: "300",
    build_height_mm: "300",
    purchase_price: "4999",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
  },

  {
    key: "raise3d-pro3-plus-hs",
    model: "Pro3 Plus HS",
    manufacturer: "Raise3D",
    process: "fdm",
    material_family: "filament",
    power_watts: "290",
    build_width_mm: "300",
    build_depth_mm: "300",
    build_height_mm: "605",
    purchase_price: "5849",
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
export function referencePriceLabel(preset: PrinterPreset): string | null {
  return preset.purchase_price === null ? null : `$${preset.purchase_price}`;
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
