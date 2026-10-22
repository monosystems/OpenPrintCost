import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { newId } from "../api/types";
import { CalculationView } from "./CalculationView";

function seed(adapter: MockPlatformAdapter) {
  return Promise.all([
    adapter.savePrinter({
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
    }),
    adapter.saveMaterial({
      id: newId(),
      name: "PETG",
      material_type: "PETG",
      family: "filament",
      manufacturer: null,
      shop_link: null,
      density_g_cm3: "1.27",
      package_size: "1",
      unit: "kg",
      price: "29.9",
      properties: {},
    }),
  ]);
}

describe("CalculationView", () => {
  it("rechnet eine Kalkulation und zeigt das Ergebnis", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "Neue Kalkulation" }));
    await user.type(screen.getByPlaceholderText("z. B. Gehäuse-Serie"), "Gehäuse-Test");
    await user.click(screen.getByRole("button", { name: "Datei hinzufügen" }));

    const fileCard = (await screen.findByLabelText("Dateiname")).closest("li");
    if (!fileCard) throw new Error("Dateikarte fehlt");
    await user.type(within(fileCard).getByLabelText("Dateiname"), "Gehäuse.stl");

    const materialSelect = within(fileCard).getByLabelText("Material wählen");
    // Material per Option wählen:
    const options = within(materialSelect).getAllByRole("option");
    const petg = options.find((o) => o.textContent === "PETG");
    if (!petg) throw new Error("PETG fehlt");
    await user.selectOptions(materialSelect, (petg as HTMLOptionElement).value);
    await user.click(within(fileCard).getByRole("button", { name: "Hinzufügen" }));
    await waitFor(() =>
      expect(
        within(fileCard).getByRole("button", { name: "Material PETG entfernen" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Berechnen" }));
    await waitFor(() => expect(screen.getByText(/Ergebnis:/)).toBeInTheDocument());
    expect(screen.getByText("Gesamtkosten", { selector: "h4" })).toBeInTheDocument();
  });

  it("übernimmt die GCode-Druckzeit aus dem Import", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "Neue Kalkulation" }));
    await user.click(screen.getByRole("button", { name: "Datei hinzufügen" }));

    const fileCard = (await screen.findByLabelText("Dateiname")).closest("li");
    if (!fileCard) throw new Error("Dateikarte fehlt");
    await user.click(within(fileCard).getByRole("button", { name: "GCode importieren" }));

    await waitFor(() =>
      expect(within(fileCard).getByLabelText("Druckzeit (h)")).toHaveValue("2.5"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/PrusaSlicer erkannt/);
  });

  it("verlangt Projektname und Datei vor der Berechnung", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "Neue Kalkulation" }));
    await user.click(screen.getByRole("button", { name: "Berechnen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Projektname/);
  });
});
