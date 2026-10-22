/**
 * Der Plattform-Port: die einzige Stelle, über die die Oberfläche mit der
 * Außenwelt (Tauri-Backend oder Mock) spricht.
 *
 * Regel: Keine Komponente außer `tauriAdapter.ts` darf `@tauri-apps/api`
 * importieren. Tests und Browser-Entwicklung laufen gegen `mockAdapter.ts`.
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
  Uuid,
  Workstep,
  WorkstepCategory,
} from "./types";

/** Fehler über die Plattformgrenze — immer mit deutscher Meldung. */
export class AdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface PlatformAdapter {
  // -- Drucker -------------------------------------------------------------
  listPrinters(): Promise<Printer[]>;
  getPrinter(id: Uuid): Promise<Printer>;
  savePrinter(printer: Printer): Promise<void>;
  deletePrinter(id: Uuid): Promise<void>;

  // -- Material ------------------------------------------------------------
  listMaterials(): Promise<Material[]>;
  getMaterial(id: Uuid): Promise<Material>;
  saveMaterial(material: Material): Promise<void>;
  deleteMaterial(id: Uuid): Promise<void>;

  // -- Arbeitsschritte -----------------------------------------------------
  listWorkstepCategories(): Promise<WorkstepCategory[]>;
  saveWorkstepCategory(category: WorkstepCategory): Promise<void>;
  deleteWorkstepCategory(id: Uuid): Promise<void>;
  listWorksteps(): Promise<Workstep[]>;
  getWorkstep(id: Uuid): Promise<Workstep>;
  saveWorkstep(workstep: Workstep): Promise<void>;
  deleteWorkstep(id: Uuid): Promise<void>;

  // -- Maschinenstundensätze -------------------------------------------------
  listHourlyRates(): Promise<HourlyRate[]>;
  getHourlyRate(id: Uuid): Promise<HourlyRate>;
  saveHourlyRate(rate: HourlyRate): Promise<void>;
  deleteHourlyRate(id: Uuid): Promise<void>;

  // -- Umgebung --------------------------------------------------------------
  getDatabasePath(): Promise<string>;

  // -- Kalkulationsprofile ---------------------------------------------------
  listCalculationProfiles(): Promise<CalculationProfile[]>;
  getCalculationProfile(id: Uuid): Promise<CalculationProfile>;
  saveCalculationProfile(profile: CalculationProfile): Promise<void>;
  deleteCalculationProfile(id: Uuid): Promise<void>;

  // -- Kalkulationen -----------------------------------------------------------
  listCalculations(): Promise<CalculationSummary[]>;
  getCalculation(id: Uuid): Promise<StoredCalculation>;
  saveCalculation(calculation: CalculationInput): Promise<void>;
  deleteCalculation(id: Uuid): Promise<void>;

  // -- Berechnung --------------------------------------------------------------
  calculate(calculation: CalculationInput): Promise<CalculationResult>;

  // -- Datei-Import --------------------------------------------------------------
  /**
   * Öffnet einen Dateidialog und liefert den gewählten Pfad (oder `null`
   * bei Abbruch). Nur im Tauri-Betrieb; der Mock liefert immer `null`.
   */
  pickImportFile(kind: "gcode" | "stl"): Promise<string | null>;
  importGcodeFile(path: string): Promise<GcodeInfo>;
  importStlFile(path: string): Promise<StlInfo>;

  // -- Export ------------------------------------------------------------------
  /**
   * Rendert das Ergebnis und speichert es über den Dateidialog.
   * Gibt den Pfad zurück — oder `null` bei Abbruch des Dialogs.
   */
  exportResultPdf(result: CalculationResult, company: CompanyInfo): Promise<string | null>;
  exportResultExcel(result: CalculationResult, company: CompanyInfo): Promise<string | null>;
}
