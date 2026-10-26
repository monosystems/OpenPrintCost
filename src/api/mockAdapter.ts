/**
 * The mock adapter: an in-memory implementation of `PlatformAdapter`.
 *
 * Purposes:
 * - Browser development without a Tauri binary (`VITE_MOCK_API=1`),
 * - component tests (Vitest + Testing Library).
 *
 * Semantics match the Rust backend: `NotFound` errors for unknown IDs,
 * categories in use cannot be deleted (`InUse`), lists are sorted
 * alphabetically.
 */
import { AdapterError, type PlatformAdapter } from "./platform";
import { checkPrintability } from "./printability";
import type {
  CalculationInput,
  CalculationProfile,
  CalculationResult,
  CompanyInfo,
  CalculationSummary,
  CostPosition,
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

function notFound(entity: string, id: Uuid): AdapterError {
  return new AdapterError(`${entity} with this ID was not found (${id}).`);
}

export class MockPlatformAdapter implements PlatformAdapter {
  /** Version reported to the UI — tests can overwrite it. */
  appVersion = "0.0.0-mock";
  /** Update offered by `checkForUpdate`; `null` means up to date. */
  availableUpdate: UpdateInfo | null = null;

  private printers = new Map<Uuid, Printer>();
  private materials = new Map<Uuid, Material>();
  private categories = new Map<Uuid, WorkstepCategory>();
  private worksteps = new Map<Uuid, Workstep>();
  private rates = new Map<Uuid, HourlyRate>();
  private profiles = new Map<Uuid, CalculationProfile>();
  private calculations = new Map<Uuid, { stored: StoredCalculation; updatedAt: string }>();
  private lastExportedCalculation: CalculationInput | null = null;

  // -- Printers -------------------------------------------------------------
  async listPrinters(): Promise<Printer[]> {
    return [...this.printers.values()].sort((a, b) => a.model.localeCompare(b.model));
  }
  async getPrinter(id: Uuid): Promise<Printer> {
    const found = this.printers.get(id);
    if (!found) throw notFound("Printer", id);
    return structuredClone(found);
  }
  async savePrinter(printer: Printer): Promise<void> {
    this.printers.set(printer.id, structuredClone(printer));
  }
  async deletePrinter(id: Uuid): Promise<void> {
    if (!this.printers.delete(id)) throw notFound("Printer", id);
  }

  // -- Materials ------------------------------------------------------------
  async listMaterials(): Promise<Material[]> {
    return [...this.materials.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getMaterial(id: Uuid): Promise<Material> {
    const found = this.materials.get(id);
    if (!found) throw notFound("Material", id);
    return structuredClone(found);
  }
  async saveMaterial(material: Material): Promise<void> {
    this.materials.set(material.id, structuredClone(material));
  }
  async deleteMaterial(id: Uuid): Promise<void> {
    if (!this.materials.delete(id)) throw notFound("Material", id);
  }

  // -- Work steps -----------------------------------------------------
  async listWorkstepCategories(): Promise<WorkstepCategory[]> {
    return [...this.categories.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async saveWorkstepCategory(category: WorkstepCategory): Promise<void> {
    this.categories.set(category.id, structuredClone(category));
  }
  async deleteWorkstepCategory(id: Uuid): Promise<void> {
    const inUse = [...this.worksteps.values()].some((w) => w.category.id === id);
    if (inUse) {
      throw new AdapterError(
        "This category is still in use and cannot be deleted.",
      );
    }
    if (!this.categories.delete(id)) throw notFound("Category", id);
  }
  async listWorksteps(): Promise<Workstep[]> {
    return [...this.worksteps.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getWorkstep(id: Uuid): Promise<Workstep> {
    const found = this.worksteps.get(id);
    if (!found) throw notFound("Work step", id);
    return structuredClone(found);
  }
  async saveWorkstep(workstep: Workstep): Promise<void> {
    if (!this.categories.has(workstep.category.id)) {
      throw notFound("Category", workstep.category.id);
    }
    this.worksteps.set(workstep.id, structuredClone(workstep));
  }
  async deleteWorkstep(id: Uuid): Promise<void> {
    if (!this.worksteps.delete(id)) throw notFound("Work step", id);
  }

  // -- Machine hourly rates -------------------------------------------------
  async listHourlyRates(): Promise<HourlyRate[]> {
    return [...this.rates.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getHourlyRate(id: Uuid): Promise<HourlyRate> {
    const found = this.rates.get(id);
    if (!found) throw notFound("Hourly rate", id);
    return structuredClone(found);
  }
  async saveHourlyRate(rate: HourlyRate): Promise<void> {
    this.rates.set(rate.id, structuredClone(rate));
  }
  async deleteHourlyRate(id: Uuid): Promise<void> {
    if (!this.rates.delete(id)) throw notFound("Hourly rate", id);
  }

  // -- Calculation profiles ---------------------------------------------------
  async listCalculationProfiles(): Promise<CalculationProfile[]> {
    return [...this.profiles.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getCalculationProfile(id: Uuid): Promise<CalculationProfile> {
    const found = this.profiles.get(id);
    if (!found) throw notFound("Calculation profile", id);
    return structuredClone(found);
  }
  async saveCalculationProfile(profile: CalculationProfile): Promise<void> {
    this.profiles.set(profile.id, structuredClone(profile));
  }
  async deleteCalculationProfile(id: Uuid): Promise<void> {
    if (!this.profiles.delete(id)) throw notFound("Calculation profile", id);
  }

  // -- Calculations -----------------------------------------------------------
  async listCalculations(): Promise<CalculationSummary[]> {
    return [...this.calculations.values()]
      .map(({ stored, updatedAt }) => ({
        id: stored.id,
        project_name: stored.project_name,
        created_at: stored.created_at,
        updated_at: updatedAt,
        file_count: stored.document.files.length,
        total_quantity: stored.document.files.reduce((sum, file) => sum + file.quantity, 0),
      }))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  async getCalculation(id: Uuid): Promise<StoredCalculation> {
    const found = this.calculations.get(id);
    if (!found) throw notFound("Calculation", id);
    return structuredClone(found.stored);
  }
  async saveCalculation(calculation: CalculationInput): Promise<void> {
    const now = new Date().toISOString();
    const existing = this.calculations.get(calculation.id);
    this.calculations.set(calculation.id, {
      stored: {
        id: calculation.id,
        project_name: calculation.project_name,
        created_at: existing?.stored.created_at ?? now,
        updated_at: now,
        document: structuredClone(calculation),
      },
      updatedAt: now,
    });
  }
  async deleteCalculation(id: Uuid): Promise<void> {
    if (!this.calculations.delete(id)) throw notFound("Calculation", id);
  }

  // -- Calculation --------------------------------------------------------------
  /**
   * Demo calculation for UI and tests: mirrors the input into a
   * plausible result (no real engine — that lives in `opc-core`).
   */
  async calculate(calculation: CalculationInput): Promise<CalculationResult> {
    const positions: CostPosition[] = [];
    for (const file of calculation.files) {
      for (const entry of file.materials) {
        positions.push({
          id: crypto.randomUUID(),
          group: "material",
          label: entry.material.name,
          detail: "Demo",
          quantity: "1",
          unit: "g",
          amount: "1.00",
          file_id: file.id,
          source_id: entry.material.id,
          is_fail_rate: false,
          excluded_from_margin: false,
        });
      }
    }
    const total = positions.length.toFixed(2);
    positions.push({
      id: crypto.randomUUID(),
      group: "total",
      label: "Selling price",
      detail: `${total} €`,
      quantity: null,
      unit: null,
      amount: total,
      file_id: null,
      source_id: null,
      is_fail_rate: false,
      excluded_from_margin: false,
    });
    const totalQuantity = calculation.files.reduce((sum, file) => sum + file.quantity, 0);
    const perPiece =
      totalQuantity > 0 ? (Number(total) / totalQuantity).toFixed(2) : null;
    return {
      id: calculation.id,
      project_name: calculation.project_name,
      created_at: calculation.created_at,
      positions,
      base_total: total,
      margin_total: "0",
      tax_total: "0",
      total,
      machine_hour_rate: "0",
      total_quantity: totalQuantity,
      cost_per_piece: perPiece,
      price_per_piece: perPiece,
      files: calculation.files.map((file) => ({
        file_id: file.id,
        file_name: file.file_name,
        quantity: file.quantity,
        print_time_hours: file.print_time_hours,
        print_time_hours_fail: "0",
        material_g: "0",
        material_g_fail: "0",
        dimensions_mm: file.dimensions_mm,
        fits_build_volume:
          checkPrintability(file.dimensions_mm, calculation.printer)?.fits ?? null,
      })),
    };
  }

  // -- Calculation documents ----------------------------------------------------
  async exportCalculationJson(calculation: CalculationInput): Promise<string | null> {
    const path = `${calculation.project_name.trim() || "calculation"}.json`;
    this.lastExportedCalculation = structuredClone(calculation);
    return path;
  }

  async importCalculationFile(): Promise<CalculationInput | null> {
    return this.lastExportedCalculation
      ? structuredClone(this.lastExportedCalculation)
      : null;
  }

  // -- File import --------------------------------------------------------------
  async pickImportFile(_kind: "gcode" | "stl"): Promise<string | null> {
    // No native dialog in the browser — demo data is returned directly.
    return null;
  }
  async importGcodeFile(_path: string): Promise<GcodeInfo> {
    return {
      time_from_comments_hours: "2.5",
      simulated_time_hours: "2.6",
      used_comments: true,
      filaments: [{ length_mm: "1200", diameter_mm: "1.75", volume_mm3: "2886.34" }],
      layer_count: 120,
      detected_slicer: "PrusaSlicer",
    };
  }
  async importStlFile(_path: string): Promise<StlInfo> {
    return {
      volume_cm3: "12.4",
      triangle_count: 512,
      bounding_box_mm: [
        [0, 0, 0],
        [40, 30, 25],
      ],
      dimensions_mm: ["40", "30", "25"],
    };
  }

  // -- Environment --------------------------------------------------------------
  async getDatabasePath(): Promise<string> {
    return ":memory: (Mock)";
  }

  async getAppVersion(): Promise<string> {
    return this.appVersion;
  }

  async checkForUpdate(): Promise<UpdateInfo | null> {
    return this.availableUpdate;
  }

  async installUpdate(): Promise<void> {
    // The real backend restarts the app after installing — nothing to do here.
    this.availableUpdate = null;
  }

  // -- Export ------------------------------------------------------------------
  async exportResultPdf(_result: CalculationResult, _company: CompanyInfo): Promise<string | null> {
    return "mock-report.pdf";
  }
  async exportResultExcel(
    _result: CalculationResult,
    _company: CompanyInfo,
  ): Promise<string | null> {
    return "mock-report.xlsx";
  }

  // -- Company info ---------------------------------------------------------------
  private company: CompanyInfo = { name: "", street: "", zip_city: "", email: "" };

  async getCompanyInfo(): Promise<CompanyInfo> {
    return { ...this.company };
  }
  async saveCompanyInfo(info: CompanyInfo): Promise<void> {
    this.company = { ...info };
  }
}
