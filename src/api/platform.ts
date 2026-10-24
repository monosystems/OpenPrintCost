/**
 * The platform port: the single place through which the UI talks to the
 * outside world (Tauri backend or mock).
 *
 * Rule: no component except `tauriAdapter.ts` may import `@tauri-apps/api`.
 * Tests and browser development run against `mockAdapter.ts`.
 */
import type {
  CalculationInput,
  CalculationProfile,
  CalculationResult,
  CalculationSummary,
  CompanyInfo,
  GcodeInfo,
  HourlyRate,
  Material,
  Printer,
  StoredCalculation,
  StlInfo,
  UpdateInfo,
  Uuid,
  Workstep,
  WorkstepCategory,
} from "./types";

/** Error across the platform boundary — always with an English message. */
export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface PlatformAdapter {
  // -- Printers -------------------------------------------------------------
  listPrinters(): Promise<Printer[]>;
  getPrinter(id: Uuid): Promise<Printer>;
  savePrinter(printer: Printer): Promise<void>;
  deletePrinter(id: Uuid): Promise<void>;

  // -- Materials ------------------------------------------------------------
  listMaterials(): Promise<Material[]>;
  getMaterial(id: Uuid): Promise<Material>;
  saveMaterial(material: Material): Promise<void>;
  deleteMaterial(id: Uuid): Promise<void>;

  // -- Work steps -----------------------------------------------------
  listWorkstepCategories(): Promise<WorkstepCategory[]>;
  saveWorkstepCategory(category: WorkstepCategory): Promise<void>;
  deleteWorkstepCategory(id: Uuid): Promise<void>;
  listWorksteps(): Promise<Workstep[]>;
  getWorkstep(id: Uuid): Promise<Workstep>;
  saveWorkstep(workstep: Workstep): Promise<void>;
  deleteWorkstep(id: Uuid): Promise<void>;

  // -- Machine hourly rates -------------------------------------------------
  listHourlyRates(): Promise<HourlyRate[]>;
  getHourlyRate(id: Uuid): Promise<HourlyRate>;
  saveHourlyRate(rate: HourlyRate): Promise<void>;
  deleteHourlyRate(id: Uuid): Promise<void>;

  // -- Environment --------------------------------------------------------------
  getDatabasePath(): Promise<string>;
  /** Version of the running application (e.g. `0.1.1`). */
  getAppVersion(): Promise<string>;

  // -- Updates ------------------------------------------------------------------
  /** Asks the release server; `null` means the running version is current. */
  checkForUpdate(): Promise<UpdateInfo | null>;
  /** Downloads and installs the offered update, then restarts the app. */
  installUpdate(): Promise<void>;

  // -- Calculation profiles ---------------------------------------------------
  listCalculationProfiles(): Promise<CalculationProfile[]>;
  getCalculationProfile(id: Uuid): Promise<CalculationProfile>;
  saveCalculationProfile(profile: CalculationProfile): Promise<void>;
  deleteCalculationProfile(id: Uuid): Promise<void>;

  // -- Calculations -----------------------------------------------------------
  listCalculations(): Promise<CalculationSummary[]>;
  getCalculation(id: Uuid): Promise<StoredCalculation>;
  saveCalculation(calculation: CalculationInput): Promise<void>;
  deleteCalculation(id: Uuid): Promise<void>;

  // -- Calculation --------------------------------------------------------------
  calculate(calculation: CalculationInput): Promise<CalculationResult>;

  // -- File import --------------------------------------------------------------
  /**
   * Opens a file dialog and returns the chosen path (or `null` on
   * cancellation). Tauri runtime only; the mock always returns `null`.
   */
  pickImportFile(kind: "gcode" | "stl"): Promise<string | null>;
  importGcodeFile(path: string): Promise<GcodeInfo>;
  importStlFile(path: string): Promise<StlInfo>;

  // -- Export ------------------------------------------------------------------
  /**
   * Renders the result and saves it via the file dialog.
   * Returns the path — or `null` when the dialog is cancelled.
   */
  exportResultPdf(result: CalculationResult, company: CompanyInfo): Promise<string | null>;
  exportResultExcel(result: CalculationResult, company: CompanyInfo): Promise<string | null>;

  // -- Company info ---------------------------------------------------------------
  getCompanyInfo(): Promise<CompanyInfo>;
  saveCompanyInfo(info: CompanyInfo): Promise<void>;
}
