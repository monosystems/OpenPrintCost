import { describe, expect, it } from "vitest";
import rustSource from "../../crates/opc-export/src/lib.rs?raw";
import { en } from "./en";
import { localizePositionLabel, POSITION_LABEL_KEYS } from "./positionLabels";

describe("localizePositionLabel", () => {
  it("translates every known core position label", () => {
    for (const label of [
      "Materialkosten",
      "Materialkosten (Fehlerrate)",
      "Maschinenkosten",
      "Maschinenkosten (Fehlerrate)",
      "Energiekosten",
      "Energiekosten (Fehlerrate)",
      "Düsenverschleiß",
      "Druckplattenverschleiß",
      "Materialwechsel",
      "Handlungspauschale",
      "Gewinnmarge",
      "Steuer",
      "Verkaufspreis",
    ]) {
      expect(localizePositionLabel(label, en)).not.toBe(label);
    }
  });

  it("keeps user-defined labels unchanged", () => {
    expect(localizePositionLabel("Sonderposten", en)).toBe("Sonderposten");
  });

  it("stays in sync with the Rust export labels", () => {
    const block = rustSource
      .split("pub fn localize_position_label")[1]
      ?.split("pub fn localize_detail_locale")[0];
    if (!block) throw new Error("Rust label block not found");

    const rustLabels = [...block.matchAll(/"([^"]+)"\s*=>\s*"/g)].map(
      (match) => match[1],
    );
    expect(new Set(rustLabels)).toEqual(new Set(Object.keys(POSITION_LABEL_KEYS)));
  });
});
