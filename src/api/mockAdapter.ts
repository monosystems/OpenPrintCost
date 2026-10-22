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
  HourlyRate,
  Material,
  Printer,
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

  // -- Umgebung --------------------------------------------------------------
  async getDatabasePath(): Promise<string> {
    return ":memory: (Mock)";
  }
}
