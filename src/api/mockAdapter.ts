/**
 * Der Mock-Adapter: eine In-Memory-Implementierung des `PlatformAdapter`.
 *
 * Zwecke:
 * - Browser-Entwicklung ohne Tauri-Binary (`VITE_MOCK_API=1`),
 * - Komponententests (Vitest + Testing Library).
 *
 * Die Semantik entspricht dem Rust-Backend: `NotFound`-Fehler bei
 * unbekannten IDs, verwaiste Kategorien sind nicht löschbar (`InUse`),
 * Listen sind alphabetisch sortiert.
 */
import { AdapterError, type PlatformAdapter } from "./platform";
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
  Uuid,
  Workstep,
  WorkstepCategory,
} from "./types";

function notFound(entity: string, id: Uuid): AdapterError {
  return new AdapterError(`${entity} mit dieser ID wurde nicht gefunden (${id}).`);
}

export class MockPlatformAdapter implements PlatformAdapter {
  private printers = new Map<Uuid, Printer>();
  private materials = new Map<Uuid, Material>();
  private categories = new Map<Uuid, WorkstepCategory>();
  private worksteps = new Map<Uuid, Workstep>();
  private rates = new Map<Uuid, HourlyRate>();
  private profiles = new Map<Uuid, CalculationProfile>();
  private calculations = new Map<Uuid, { stored: StoredCalculation; updatedAt: string }>();

  // -- Drucker -------------------------------------------------------------
  async listPrinters(): Promise<Printer[]> {
    return [...this.printers.values()].sort((a, b) => a.model.localeCompare(b.model));
  }
  async getPrinter(id: Uuid): Promise<Printer> {
    const found = this.printers.get(id);
    if (!found) throw notFound("Drucker", id);
    return structuredClone(found);
  }
  async savePrinter(printer: Printer): Promise<void> {
    this.printers.set(printer.id, structuredClone(printer));
  }
  async deletePrinter(id: Uuid): Promise<void> {
    if (!this.printers.delete(id)) throw notFound("Drucker", id);
  }

  // -- Material ------------------------------------------------------------
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

  // -- Arbeitsschritte -----------------------------------------------------
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
        "Diese Kategorie wird noch verwendet und kann nicht gelöscht werden.",
      );
    }
    if (!this.categories.delete(id)) throw notFound("Kategorie", id);
  }
  async listWorksteps(): Promise<Workstep[]> {
    return [...this.worksteps.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getWorkstep(id: Uuid): Promise<Workstep> {
    const found = this.worksteps.get(id);
    if (!found) throw notFound("Arbeitsschritt", id);
    return structuredClone(found);
  }
  async saveWorkstep(workstep: Workstep): Promise<void> {
    if (!this.categories.has(workstep.category.id)) {
      throw notFound("Kategorie", workstep.category.id);
    }
    this.worksteps.set(workstep.id, structuredClone(workstep));
  }
  async deleteWorkstep(id: Uuid): Promise<void> {
    if (!this.worksteps.delete(id)) throw notFound("Arbeitsschritt", id);
  }

  // -- Maschinenstundensätze -------------------------------------------------
  async listHourlyRates(): Promise<HourlyRate[]> {
    return [...this.rates.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getHourlyRate(id: Uuid): Promise<HourlyRate> {
    const found = this.rates.get(id);
    if (!found) throw notFound("Stundensatz", id);
    return structuredClone(found);
  }
  async saveHourlyRate(rate: HourlyRate): Promise<void> {
    this.rates.set(rate.id, structuredClone(rate));
  }
  async deleteHourlyRate(id: Uuid): Promise<void> {
    if (!this.rates.delete(id)) throw notFound("Stundensatz", id);
  }

  // -- Kalkulationsprofile ---------------------------------------------------
  async listCalculationProfiles(): Promise<CalculationProfile[]> {
    return [...this.profiles.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  async getCalculationProfile(id: Uuid): Promise<CalculationProfile> {
    const found = this.profiles.get(id);
    if (!found) throw notFound("Kalkulationsprofil", id);
    return structuredClone(found);
  }
  async saveCalculationProfile(profile: CalculationProfile): Promise<void> {
    this.profiles.set(profile.id, structuredClone(profile));
  }
  async deleteCalculationProfile(id: Uuid): Promise<void> {
    if (!this.profiles.delete(id)) throw notFound("Kalkulationsprofil", id);
  }

  // -- Kalkulationen -----------------------------------------------------------
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
    if (!found) throw notFound("Kalkulation", id);
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
    if (!this.calculations.delete(id)) throw notFound("Kalkulation", id);
  }

  // -- Berechnung --------------------------------------------------------------
  /**
   * Demo-Berechnung für Oberfläche und Tests: spiegelt die Eingabe in ein
   * plausibles Ergebnis (keine echte Engine — die läuft in `opc-core`).
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
      label: "Gesamtkosten",
      detail: `${total} €`,
      quantity: null,
      unit: null,
      amount: total,
      file_id: null,
      source_id: null,
      is_fail_rate: false,
      excluded_from_margin: false,
    });
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
      files: calculation.files.map((file) => ({
        file_id: file.id,
        file_name: file.file_name,
        quantity: file.quantity,
        print_time_hours: file.print_time_hours,
        print_time_hours_fail: "0",
        material_g: "0",
        material_g_fail: "0",
      })),
    };
  }

  // -- Datei-Import --------------------------------------------------------------
  async pickImportFile(_kind: "gcode" | "stl"): Promise<string | null> {
    // Kein nativer Dialog im Browser — die Demo-Daten kommen direkt.
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
    };
  }

  // -- Umgebung --------------------------------------------------------------
  async getDatabasePath(): Promise<string> {
    return ":memory: (Mock)";
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

  // -- Firmendaten ---------------------------------------------------------------
  private company: CompanyInfo = { name: "", street: "", zip_city: "", email: "" };

  async getCompanyInfo(): Promise<CompanyInfo> {
    return { ...this.company };
  }
  async saveCompanyInfo(info: CompanyInfo): Promise<void> {
    this.company = { ...info };
  }
}
