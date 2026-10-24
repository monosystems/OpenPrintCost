/**
 * TypeScript-Spiegel der Rust-Modelle (`opc-core`, `opc-store`).
 *
 * Regeln:
 * - Feldnamen bleiben `snake_case` wie im JSON der Commands.
 * - Money amounts and measurements are **strings** (Rust `Decimal` is
 *   serialized as string). Never use `number` for money/quantities.
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

/** Creates a random UUID v4 (browser-native). */
export function newId(): Uuid {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Kalkulation (Eingabe)
// ---------------------------------------------------------------------------

export type HandlingFeeScope = "per-file" | "once";
export type SurchargeTiming = "before-margin" | "after-margin";

export interface CalculationProfile {
  id: Uuid;
  name: string;
  fail_rate_percent: DecimalString;
  tax_rate_percent: DecimalString;
  margin_percent: DecimalString;
  handling_fee: DecimalString;
  handling_fee_scope: HandlingFeeScope;
  energy_price_per_kwh: DecimalString;
  apply_energy_costs: boolean;
  power_level_percent: DecimalString;
  combine_materials: boolean;
  multiply_print_time_with_quantity: boolean;
  print_time_factor: DecimalString;
  exclude_machine_from_margin: boolean;
  exclude_material_from_margin: boolean;
  exclude_worksteps_from_margin: boolean;
}

export interface FileMaterial {
  material: Material;
  weight_g: DecimalString | null;
}

export interface CalculationFileInput {
  id: Uuid;
  file_name: string;
  quantity: number;
  print_time_hours: DecimalString;
  volume_cm3: DecimalString | null;
  weight_g: DecimalString | null;
  materials: FileMaterial[];
  material_changes: number;
  multiply_print_time_with_quantity: boolean | null;
}

export interface AdditionalItem {
  id: Uuid;
  name: string;
  price: DecimalString;
  quantity: DecimalString;
  file_id: Uuid | null;
}

export interface CustomSurcharge {
  id: Uuid;
  name: string;
  percent: DecimalString;
  timing: SurchargeTiming;
}

export interface CalculationInput {
  id: Uuid;
  project_name: string;
  notes: string | null;
  created_at: string | null;
  printer: Printer;
  profile: CalculationProfile;
  hourly_rate: HourlyRate | null;
  worksteps: Workstep[];
  additional_items: AdditionalItem[];
  custom_surcharges: CustomSurcharge[];
  files: CalculationFileInput[];
}

// ---------------------------------------------------------------------------
// Kalkulation (Ergebnis)
// ---------------------------------------------------------------------------

export type CostGroup =
  | "material"
  | "machine"
  | "energy"
  | "process-surcharge"
  | "worksteps"
  | "additional-items"
  | "handling-fee"
  | "custom-surcharge"
  | "margin"
  | "tax"
  | "total";

export interface CostPosition {
  id: Uuid;
  group: CostGroup;
  label: string;
  detail: string | null;
  quantity: DecimalString | null;
  unit: string | null;
  amount: DecimalString;
  file_id: Uuid | null;
  source_id: Uuid | null;
  is_fail_rate: boolean;
  excluded_from_margin: boolean;
}

export interface FileSummary {
  file_id: Uuid;
  file_name: string;
  quantity: number;
  print_time_hours: DecimalString;
  print_time_hours_fail: DecimalString;
  material_g: DecimalString;
  material_g_fail: DecimalString;
}

export interface CalculationResult {
  id: Uuid;
  project_name: string;
  created_at: string | null;
  positions: CostPosition[];
  base_total: DecimalString;
  margin_total: DecimalString;
  tax_total: DecimalString;
  total: DecimalString;
  machine_hour_rate: DecimalString;
  files: FileSummary[];
}

export interface CalculationSummary {
  id: Uuid;
  project_name: string;
  created_at: string;
  updated_at: string;
  file_count: number;
  total_quantity: number;
}

export interface StoredCalculation {
  id: Uuid;
  project_name: string;
  created_at: string;
  updated_at: string;
  document: CalculationInput;
}

// ---------------------------------------------------------------------------
// Datei-Import
// ---------------------------------------------------------------------------
export interface FilamentUsage {
  length_mm: DecimalString;
  diameter_mm: DecimalString;
  volume_mm3: DecimalString;
}

export interface GcodeInfo {
  time_from_comments_hours: DecimalString | null;
  simulated_time_hours: DecimalString;
  used_comments: boolean;
  filaments: FilamentUsage[];
  layer_count: number | null;
  detected_slicer: string | null;
}

export interface StlInfo {
  volume_cm3: DecimalString;
  triangle_count: number;
  bounding_box_mm: [[number, number, number], [number, number, number]] | null;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Company info for the report header. The UI for it lives in Settings —
 * an empty `CompanyInfo` is passed until then.
 */
export interface CompanyInfo {
  name: string;
  street: string;
  zip_city: string;
  email: string;
}

export const emptyCompany: CompanyInfo = { name: "", street: "", zip_city: "", email: "" };

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

/** An update offered by the release server. */
export interface UpdateInfo {
  /** Version that would be installed. */
  version: string;
  /** Version that is running now. */
  currentVersion: string;
  /** Release notes (Markdown), when the server provides them. */
  notes: string | null;
  /** Release date (RFC 3339), when known. */
  date: string | null;
}
