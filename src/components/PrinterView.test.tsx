import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { PrinterView } from "./PrinterView";

async function renderView(adapter = new MockPlatformAdapter()) {
  const user = userEvent.setup();
  render(<PrinterView adapter={adapter} />);
  await waitFor(() => expect(screen.queryByText("Wird geladen …")).not.toBeInTheDocument());
  return { user, adapter };
}

describe("PrinterView", () => {
  it("zeigt den Leerzustand ohne Drucker", async () => {
    await renderView();
    expect(screen.getByText(/Noch keine Drucker angelegt/)).toBeInTheDocument();
  });

  it("legt einen Drucker über das Formular an", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "Neuer Drucker" }));
    await user.type(screen.getByPlaceholderText("z. B. Prusa MK4S"), "Prusa MK4S");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(screen.getByText("Prusa MK4S")).toBeInTheDocument());
    expect(await adapter.listPrinters()).toHaveLength(1);
  });

  it("lehnt ein leeres Modell mit Fehlermeldung ab", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "Neuer Drucker" }));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Modellbezeichnung/);
    expect(await adapter.listPrinters()).toHaveLength(0);
  });

  it("lehnt ungültige Zahlen ab", async () => {
    const { user } = await renderView();

    await user.click(screen.getByRole("button", { name: "Neuer Drucker" }));
    await user.type(screen.getByPlaceholderText("z. B. Prusa MK4S"), "Test");
    const leistung = screen.getByLabelText("Leistung (W) *");
    await user.clear(leistung);
    await user.type(leistung, "zwölf");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Zahl mit Punkt/);
  });

  it("löscht erst nach Bestätigung", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.savePrinter({
      id: "11111111-1111-1111-1111-111111111111",
      model: "Altgerät",
      manufacturer: null,
      process: "fdm",
      material_family: "filament",
      power_watts: "100",
      build_volume_mm3: "1000",
      purchase_price: "500",
      hourly_rate: null,
      nozzle_wear_cost: null,
      build_plate_wear_cost: null,
      material_change_cost: null,
      properties: {},
    });
    const user = userEvent.setup();
    render(<PrinterView adapter={adapter} />);
    const item = await screen.findByText("Altgerät");
    const row = item.closest("li");
    if (!row) throw new Error("Zeile fehlt");

    // Abbrechen lässt alles unverändert.
    await user.click(within(row).getByRole("button", { name: "Löschen" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByText("Altgerät")).toBeInTheDocument();
    expect(await adapter.listPrinters()).toHaveLength(1);

    // Bestätigen löscht.
    await user.click(within(row).getByRole("button", { name: "Löschen" }));
    const dialogAgain = await screen.findByRole("dialog");
    await user.click(within(dialogAgain).getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(screen.queryByText("Altgerät")).not.toBeInTheDocument());
    expect(await adapter.listPrinters()).toHaveLength(0);
  });
});
