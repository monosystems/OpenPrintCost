import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { PrinterView } from "./PrinterView";

async function renderView(adapter = new MockPlatformAdapter()) {
  const user = userEvent.setup();
  render(<PrinterView adapter={adapter} />);
  await waitFor(() => expect(screen.queryByText("Loading …")).not.toBeInTheDocument());
  return { user, adapter };
}

describe("PrinterView", () => {
  it("shows the empty state without printers", async () => {
    await renderView();
    expect(screen.getByText(/No printers yet/)).toBeInTheDocument();
  });

  it("creates a printer via the form", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "New printer" }));
    await user.type(screen.getByPlaceholderText("e.g. Prusa MK4S"), "Prusa MK4S");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Prusa MK4S")).toBeInTheDocument());
    expect(await adapter.listPrinters()).toHaveLength(1);
  });

  it("calculates the build volume from the maximum print size", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "New printer" }));
    await user.type(screen.getByPlaceholderText("e.g. Prusa MK4S"), "Prusa XL");
    const width = screen.getByLabelText("Max. width X (mm) *");
    const depth = screen.getByLabelText("Max. depth Y (mm) *");
    const height = screen.getByLabelText("Max. height Z (mm) *");
    await user.clear(width);
    await user.type(width, "250");
    await user.clear(depth);
    await user.type(depth, "210");
    await user.clear(height);
    await user.type(height, "220");

    expect(screen.getByText("11,550,000 mm³")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(async () => expect(await adapter.listPrinters()).toHaveLength(1));
    expect((await adapter.listPrinters())[0]).toMatchObject({
      build_width_mm: "250",
      build_depth_mm: "210",
      build_height_mm: "220",
    });
  });

  it("groups the printer form into labelled sections", async () => {
    const { user } = await renderView();

    await user.click(screen.getByRole("button", { name: "New printer" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Device")).toBeInTheDocument();
    expect(within(dialog).getByText("Technical data")).toBeInTheDocument();
    expect(within(dialog).getByText("Costs")).toBeInTheDocument();
    expect(within(dialog).getByText("Fields marked * are required.")).toBeInTheDocument();
  });

  it("rejects an empty model with an error", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "New printer" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/model name/i);
    expect(await adapter.listPrinters()).toHaveLength(0);
  });

  it("rejects invalid numbers", async () => {
    const { user } = await renderView();

    await user.click(screen.getByRole("button", { name: "New printer" }));
    await user.type(screen.getByPlaceholderText("e.g. Prusa MK4S"), "Test");
    const leistung = screen.getByLabelText("Power (W) *");
    await user.clear(leistung);
    await user.type(leistung, "twelve");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/number with a dot/);
  });

  it("deletes only after confirmation", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.savePrinter({
      id: "11111111-1111-1111-1111-111111111111",
      model: "Old device",
      manufacturer: null,
      process: "fdm",
      material_family: "filament",
      power_watts: "100",
      build_width_mm: "10",
      build_depth_mm: "10",
      build_height_mm: "10",
      purchase_price: "500",
      hourly_rate: null,
      nozzle_wear_cost: null,
      build_plate_wear_cost: null,
      material_change_cost: null,
      properties: {},
    });
    const user = userEvent.setup();
    render(<PrinterView adapter={adapter} />);
    const item = await screen.findByText("Old device");
    const row = item.closest("tr");
    if (!row) throw new Error("Row missing");

    // Cancel leaves everything unchanged.
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Old device")).toBeInTheDocument();
    expect(await adapter.listPrinters()).toHaveLength(1);

    // Confirming deletes.
    await user.click(within(row).getByRole("button", { name: "Delete" }));
    const dialogAgain = await screen.findByRole("dialog");
    await user.click(within(dialogAgain).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Old device")).not.toBeInTheDocument());
    expect(await adapter.listPrinters()).toHaveLength(0);
  });
});
