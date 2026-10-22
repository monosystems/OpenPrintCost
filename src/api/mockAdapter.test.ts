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
    build_volume_mm3: "1000000",
    purchase_price: "799",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
    properties: {},
  };
}

describe("MockPlatformAdapter", () => {
  it("legt Drucker an, liest sie und sortiert alphabetisch", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.savePrinter(printer("Zebra"));
    await adapter.savePrinter(printer("Alpha"));

    const all = await adapter.listPrinters();
    expect(all.map((p) => p.model)).toEqual(["Alpha", "Zebra"]);
    const first = all[0];
    if (!first) throw new Error("erster Drucker fehlt");
    expect(await adapter.getPrinter(first.id)).toMatchObject({ model: "Alpha" });
  });

  it("aktualisiert statt zu verdoppeln", async () => {
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

  it("meldet NotFound bei unbekannten IDs", async () => {
    const adapter = new MockPlatformAdapter();
    await expect(adapter.getPrinter(newId())).rejects.toThrow(/nicht gefunden/);
    await expect(adapter.deletePrinter(newId())).rejects.toThrow(/nicht gefunden/);
    await expect(adapter.deleteMaterial(newId())).rejects.toThrow(/nicht gefunden/);
  });

  it("gibt gespeicherte Objekte als Kopie zurück", async () => {
    const adapter = new MockPlatformAdapter();
    const first = printer("MK3");
    await adapter.savePrinter(first);

    const loaded = await adapter.getPrinter(first.id);
    loaded.model = "verändert";
    expect((await adapter.getPrinter(first.id)).model).toBe("MK3");
  });

  it("verhindert das Löschen benutzter Kategorien", async () => {
    const adapter = new MockPlatformAdapter();
    const category = { id: newId(), name: "Nachbearbeitung", color: null };
    await adapter.saveWorkstepCategory(category);
    await adapter.saveWorkstep({
      id: newId(),
      name: "Entstutzung",
      category,
      calculation_type: "per-piece",
      price: "0.5",
      quantity: "1",
      duration_hours: "0",
      timing: "other",
    });

    await expect(adapter.deleteWorkstepCategory(category.id)).rejects.toThrow(/noch verwendet/);
  });

  it("lehnt Arbeitsschritte mit unbekannter Kategorie ab", async () => {
    const adapter = new MockPlatformAdapter();
    await expect(
      adapter.saveWorkstep({
        id: newId(),
        name: "Waisenkind",
        category: { id: newId(), name: "Unbekannt", color: null },
        calculation_type: "per-piece",
        price: "1",
        quantity: "1",
        duration_hours: "0",
        timing: "other",
      }),
    ).rejects.toThrow(/nicht gefunden/);
  });
});
