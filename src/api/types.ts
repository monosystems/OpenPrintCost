/**
 * TypeScript-Spiegel der Rust-Modelle (`opc-core`, `opc-store`).
 *
 * Regeln:
 * - Feldnamen bleiben `snake_case` wie im JSON der Commands.
 * - Geldbeträge und Messwerte sind **Strings** (Rust-`Decimal` wird als
 *   String serialisiert). Niemals `number` für Geld/Mengen verwenden.
 * - Enums sind kebab-case-Strings wie im Rust-`serde`.
 * - `Option<T>` wird zu `T | null`.
 */

export type Uuid = string;
export type DecimalString = string;

export type PrintProcess = "fdm" | "sla" | "powder-bed";
export type MaterialFamily = "filament" | "resin" | "powder";
export type MaterialUnit = "kg" | "g" | "lb" | "oz";
export type WorkstepCalculationType = "per-hour" | "per-piece" | "per-order";
export type WorkstepTiming = "before" | "after" | "other";
export type TimeBasis = "per-year" | "per-month";

export interface Printer {
  id: Uuid;
  model: string;
  manufacturer: string | null;
  process: PrintProcess;
  material_family: MaterialFamily;
  power_watts: DecimalString;
  build_volume_mm3: DecimalString;
  purchase_price: DecimalString;
  hourly_rate: DecimalString | null;
  nozzle_wear_cost: DecimalString | null;
  build_plate_wear_cost: DecimalString | null;
  material_change_cost: DecimalString | null;
  properties: Record<string, string>;
}

export interface Material {
  id: Uuid;
  name: string;
  material_type: string;
  family: MaterialFamily;
  manufacturer: string | null;
  shop_link: string | null;
  density_g_cm3: DecimalString;
  package_size: DecimalString;
  unit: MaterialUnit;
  price: DecimalString;
  properties: Record<string, string>;
}

export interface WorkstepCategory {
  id: Uuid;
  name: string;
  color: string | null;
}

export interface Workstep {
  id: Uuid;
  name: string;
  category: WorkstepCategory;
  calculation_type: WorkstepCalculationType;
  price: DecimalString;
  quantity: DecimalString;
  duration_hours: DecimalString;
  timing: WorkstepTiming;
}

export interface HourlyRate {
  id: Uuid;
  name: string;
  time_basis: TimeBasis;
  machine_hours: DecimalString;
  replacement_cost: DecimalString;
  service_life_years: DecimalString;
  interest_rate_percent: DecimalString;
  maintenance_fixed: DecimalString;
  rent_fixed: DecimalString;
  electricity_fixed: DecimalString;
  additional_fixed: DecimalString;
  maintenance_variable: DecimalString;
  electricity_variable: DecimalString;
  additional_variable: DecimalString;
  fixed_rate_override: DecimalString | null;
}

/** Erzeugt eine zufällige UUID v4 (Browser-nativ). */
export function newId(): Uuid {
  return crypto.randomUUID();
}
