/**
 * Der Tauri-Adapter: die einzige Datei mit `@tauri-apps/api`-Import.
 *
 * Jede Methode ruft genau einen Tauri-Command auf (siehe
 * `src-tauri/src/commands.rs`). IDs laufen als UUID-Text, Beträge als
 * String — exakt wie die Rust-Seite sie erwartet.
 */
import { invoke } from "@tauri-apps/api/core";
import { AdapterError, type PlatformAdapter } from "./platform";
import type {
  HourlyRate,
  Material,
  Printer,
  Uuid,
  Workstep,
  WorkstepCategory,
} from "./types";

/** Übersetzt einen Backend-Fehler in einen `AdapterError`. */
function toError(error: unknown): AdapterError {
  if (error instanceof AdapterError) return error;
  if (typeof error === "string") return new AdapterError(error);
  if (error !== null && typeof error === "object") {
    const withMessage = error as { message?: unknown };
    if (typeof withMessage.message === "string") {
      return new AdapterError(withMessage.message);
    }
  }
  return new AdapterError("Unbekannter Fehler bei der Datenübertragung.");
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw toError(error);
  }
}

export class TauriPlatformAdapter implements PlatformAdapter {
  listPrinters(): Promise<Printer[]> {
    return call("list_printers");
  }
  getPrinter(id: Uuid): Promise<Printer> {
    return call("get_printer", { id });
  }
  savePrinter(printer: Printer): Promise<void> {
    return call("save_printer", { printer });
  }
  deletePrinter(id: Uuid): Promise<void> {
    return call("delete_printer", { id });
  }

  listMaterials(): Promise<Material[]> {
    return call("list_materials");
  }
  getMaterial(id: Uuid): Promise<Material> {
    return call("get_material", { id });
  }
  saveMaterial(material: Material): Promise<void> {
    return call("save_material", { material });
  }
  deleteMaterial(id: Uuid): Promise<void> {
    return call("delete_material", { id });
  }

  listWorkstepCategories(): Promise<WorkstepCategory[]> {
    return call("list_workstep_categories");
  }
  saveWorkstepCategory(category: WorkstepCategory): Promise<void> {
    return call("save_workstep_category", { category });
  }
  deleteWorkstepCategory(id: Uuid): Promise<void> {
    return call("delete_workstep_category", { id });
  }
  listWorksteps(): Promise<Workstep[]> {
    return call("list_worksteps");
  }
  getWorkstep(id: Uuid): Promise<Workstep> {
    return call("get_workstep", { id });
  }
  saveWorkstep(workstep: Workstep): Promise<void> {
    return call("save_workstep", { workstep });
  }
  deleteWorkstep(id: Uuid): Promise<void> {
    return call("delete_workstep", { id });
  }

  listHourlyRates(): Promise<HourlyRate[]> {
    return call("list_hourly_rates");
  }
  getHourlyRate(id: Uuid): Promise<HourlyRate> {
    return call("get_hourly_rate", { id });
  }
  saveHourlyRate(rate: HourlyRate): Promise<void> {
    return call("save_hourly_rate", { rate });
  }
  deleteHourlyRate(id: Uuid): Promise<void> {
    return call("delete_hourly_rate", { id });
  }

  getDatabasePath(): Promise<string> {
    return call("database_path");
  }
}
