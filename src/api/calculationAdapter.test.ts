import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "./mockAdapter";
import { newId, type CalculationInput, type Printer } from "./types";

function printer(): Printer {
  return {
    id: newId(),
    model: "MK4",
    manufacturer: null,
    process: "fdm",
    material_family: "filament",
    power_watts: "110",
    build_volume_mm3: "1000000",
    purchase_price: "799",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
    properties: {},
  };
}

function calculation(usedPrinter: Printer): CalculationInput {
  return {
    id: newId(),
    project_name: "Gehäuse",
    notes: null,
    created_at: null,
    printer: usedPrinter,
    profile: {
      id: newId(),
      name: "Standard",
      fail_rate_percent: "0",
      tax_rate_percent: "19",
      margin_percent: "0",
      handling_fee: "0",
      handling_fee_scope: "once",
      energy_price_per_kwh: "0.35",
      apply_energy_costs: false,
      power_level_percent: "100",
      combine_materials: false,
      multiply_print_time_with_quantity: true,
      print_time_factor: "1",
      exclude_machine_from_margin: false,
      exclude_material_from_margin: false,
      exclude_worksteps_from_margin: false,
    },
    hourly_rate: null,
    worksteps: [],
    additional_items: [],
    custom_surcharges: [],
    files: [],
  };
}

describe("MockPlatformAdapter (Kalkulationen)", () => {
  it("speichert, listet, lädt und löscht Kalkulationen", async () => {
    const adapter = new MockPlatformAdapter();
    const usedPrinter = printer();
    await adapter.saveCalculation(calculation(usedPrinter));

    const list = await adapter.listCalculations();
    expect(list).toHaveLength(1);
    const entry = list[0];
    if (!entry) throw new Error("Eintrag fehlt");
    expect(entry).toMatchObject({ project_name: "Gehäuse", file_count: 0 });

    const loaded = await adapter.getCalculation(entry.id);
    expect(loaded.document.printer.model).toBe("MK4");

    await adapter.deleteCalculation(entry.id);
    expect(await adapter.listCalculations()).toHaveLength(0);
    await expect(adapter.getCalculation(entry.id)).rejects.toThrow(/nicht gefunden/);
  });

  it("speichert einen Schnappschuss — spätere Änderungen wirken nicht", async () => {
    const adapter = new MockPlatformAdapter();
    const input = calculation(printer());
    await adapter.saveCalculation(input);

    // Das übergebene Objekt wird danach verändert …
    input.project_name = "Verändert";

    const list = await adapter.listCalculations();
    const entry = list[0];
    if (!entry) throw new Error("Eintrag fehlt");
    const loaded = await adapter.getCalculation(entry.id);
    expect(loaded.document.project_name).toBe("Gehäuse");
    expect(loaded.project_name).toBe("Gehäuse");
  });

  it("liefert ein darstellbares Demo-Ergebnis", async () => {
    const adapter = new MockPlatformAdapter();
    const usedPrinter = printer();
    const input = calculation(usedPrinter);

    const result = await adapter.calculate(input);
    expect(result.project_name).toBe("Gehäuse");
    expect(result.positions.some((p) => p.group === "total")).toBe(true);
  });

  it("liefert Demo-Importdaten", async () => {
    const adapter = new MockPlatformAdapter();
    const gcode = await adapter.importGcodeFile("demo");
    expect(gcode.used_comments).toBe(true);
    expect(gcode.time_from_comments_hours).toBe("2.5");

    const stl = await adapter.importStlFile("demo");
    expect(stl.volume_cm3).toBe("12.4");
    expect(await adapter.pickImportFile("gcode")).toBeNull();
  });
});
