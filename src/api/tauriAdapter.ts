/**
 * The Tauri adapter: the only file with an `@tauri-apps/api` import.
 *
 * Each method calls exactly one Tauri command (see
 * `src-tauri/src/commands.rs`). IDs travel as UUID text, amounts as
 * strings — exactly as the Rust side expects.
 */
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { Locale } from "../i18n";
import { localizeErrorMessage } from "./errors";
import { AdapterError, type PlatformAdapter } from "./platform";
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
  ThreeMfInfo,
  UpdateInfo,
  Uuid,
  Workstep,
  WorkstepCategory,
} from "./types";

/** Maps a backend error to an `AdapterError`. */
function toError(error: unknown): AdapterError {
  if (error instanceof AdapterError) return error;
  if (typeof error === "string") return new AdapterError(localizeErrorMessage(error));
  if (error !== null && typeof error === "object") {
    const withMessage = error as { message?: unknown };
    if (typeof withMessage.message === "string") {
      return new AdapterError(localizeErrorMessage(withMessage.message));
    }
  }
  return new AdapterError("Unknown data transfer error.");
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

  getAppVersion(): Promise<string> {
    return call("app_version");
  }

  checkForUpdate(): Promise<UpdateInfo | null> {
    return call("check_update");
  }

  installUpdate(): Promise<void> {
    return call("install_update");
  }

  listCalculationProfiles(): Promise<CalculationProfile[]> {
    return call("list_calculation_profiles");
  }
  getCalculationProfile(id: Uuid): Promise<CalculationProfile> {
    return call("get_calculation_profile", { id });
  }
  saveCalculationProfile(profile: CalculationProfile): Promise<void> {
    return call("save_calculation_profile", { profile });
  }
  deleteCalculationProfile(id: Uuid): Promise<void> {
    return call("delete_calculation_profile", { id });
  }

  listCalculations(): Promise<CalculationSummary[]> {
    return call("list_calculations");
  }
  getCalculation(id: Uuid): Promise<StoredCalculation> {
    return call("get_calculation", { id });
  }
  saveCalculation(calculation: CalculationInput): Promise<void> {
    return call("save_calculation", { calculation });
  }
  deleteCalculation(id: Uuid): Promise<void> {
    return call("delete_calculation", { id });
  }

  calculate(calculation: CalculationInput): Promise<CalculationResult> {
    return call("calculate", { calculation });
  }

  async pickImportFile(kind: "gcode" | "stl" | "3mf"): Promise<string | null> {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [
          kind === "gcode"
            ? { name: "GCode", extensions: ["gcode", "gco", "g"] }
            : kind === "stl"
              ? { name: "STL", extensions: ["stl"] }
              : { name: "3MF", extensions: ["3mf"] },
        ],
      });
      return typeof selected === "string" ? selected : null;
    } catch (error) {
      throw toError(error);
    }
  }
  importGcodeFile(path: string): Promise<GcodeInfo> {
    return call("import_gcode_file", { path });
  }
  importStlFile(path: string): Promise<StlInfo> {
    return call("import_stl_file", { path });
  }
  import3mfFile(path: string): Promise<ThreeMfInfo> {
    return call("import_3mf_file", { path });
  }

  exportCalculationJson(calculation: CalculationInput): Promise<string | null> {
    return call("export_calculation_json", { calculation });
  }
  importCalculationFile(): Promise<CalculationInput | null> {
    return call("import_calculation_json");
  }

  exportResultPdf(
    result: CalculationResult,
    company: CompanyInfo,
    locale?: Locale,
  ): Promise<string | null> {
    return call("export_result_pdf", { result, company, locale });
  }
  exportResultExcel(
    result: CalculationResult,
    company: CompanyInfo,
    locale?: Locale,
  ): Promise<string | null> {
    return call("export_result_excel", { result, company, locale });
  }

  getCompanyInfo(): Promise<CompanyInfo> {
    return call("get_company_info");
  }
  saveCompanyInfo(info: CompanyInfo): Promise<void> {
    return call("save_company_info", { info });
  }
}
