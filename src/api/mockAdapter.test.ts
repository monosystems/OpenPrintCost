import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "./mockAdapter";
import { newId, type Printer } from "./types";

function printer(model: string): Printer {
  return {
    id: newId(),
    model,
    manufacturer: null,
    process: "fdm",
    material_family: "filament",
    power_watts: "110",
    build_width_mm: "100",
    build_depth_mm: "100",
    build_height_mm: "100",
    purchase_price: "799",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
    properties: {},
  };
}

describe("MockPlatformAdapter", () => {
  it("creates printers, reads them, and sorts alphabetically", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.savePrinter(printer("Zebra"));
    await adapter.savePrinter(printer("Alpha"));

    const all = await adapter.listPrinters();
    expect(all.map((p) => p.model)).toEqual(["Alpha", "Zebra"]);
    const first = all[0];
    if (!first) throw new Error("erster Drucker fehlt");
    expect(await adapter.getPrinter(first.id)).toMatchObject({ model: "Alpha" });
  });

  it("updates instead of duplicating", async () => {
    const adapter = new MockPlatformAdapter();
    const first = printer("MK3");
    await adapter.savePrinter(first);
    await adapter.savePrinter({ ...first, model: "MK4" });

    const all = await adapter.listPrinters();
    expect(all).toHaveLength(1);
    const only = all[0];
    if (!only) throw new Error("Drucker fehlt");
    expect(only.model).toBe("MK4");
  });

  it("reports NotFound for unknown IDs", async () => {
    const adapter = new MockPlatformAdapter();
    await expect(adapter.getPrinter(newId())).rejects.toThrow(/was not found/);
    await expect(adapter.deletePrinter(newId())).rejects.toThrow(/was not found/);
    await expect(adapter.deleteMaterial(newId())).rejects.toThrow(/was not found/);
  });

  it("returns stored objects as copies", async () => {
    const adapter = new MockPlatformAdapter();
    const first = printer("MK3");
    await adapter.savePrinter(first);

    const loaded = await adapter.getPrinter(first.id);
    loaded.model = "changed";
    expect((await adapter.getPrinter(first.id)).model).toBe("MK3");
  });

  it("prevents deleting categories in use", async () => {
    const adapter = new MockPlatformAdapter();
    const category = { id: newId(), name: "Post-processing", color: null };
    await adapter.saveWorkstepCategory(category);
    await adapter.saveWorkstep({
      id: newId(),
      name: "Support removal",
      category,
      calculation_type: "per-piece",
      price: "0.5",
      quantity: "1",
      duration_hours: "0",
      timing: "other",
    });

    await expect(adapter.deleteWorkstepCategory(category.id)).rejects.toThrow(/still in use/);
  });

  it("rejects work steps with unknown category", async () => {
    const adapter = new MockPlatformAdapter();
    await expect(
      adapter.saveWorkstep({
        id: newId(),
        name: "Orphan",
        category: { id: newId(), name: "Unknown", color: null },
        calculation_type: "per-piece",
        price: "1",
        quantity: "1",
        duration_hours: "0",
        timing: "other",
      }),
    ).rejects.toThrow(/was not found/);
  });
});
