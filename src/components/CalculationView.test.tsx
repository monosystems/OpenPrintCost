import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { emptyCompany, newId, type CalculationProfile } from "../api/types";
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
  it("calculates and shows the result", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Enclosure-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.type(within(fileCard).getByLabelText("File name"), "Enclosure.stl");

    const materialSelect = within(fileCard).getByLabelText("Choose material");
    // Select the material via option:
    const options = within(materialSelect).getAllByRole("option");
    const petg = options.find((o) => o.textContent === "PETG");
    if (!petg) throw new Error("PETG missing");
    await user.selectOptions(materialSelect, (petg as HTMLOptionElement).value);
    await user.click(within(fileCard).getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(
        within(fileCard).getByRole("button", { name: "Remove material PETG" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());
    expect(screen.getByText("Total cost", { selector: "h4" })).toBeInTheDocument();
  });

  it("takes the G-code print time from the import", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import G-code" }));

    await waitFor(() =>
      expect(within(fileCard).getByLabelText("Print time (h)")).toHaveValue("2.5"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/PrusaSlicer detected/);
  });

  it("exports the result and shows the path", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Export-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(await screen.findByRole("status")).toHaveTextContent("mock-report.pdf");

    await user.click(screen.getByRole("button", { name: "Export Excel" }));
    expect(await screen.findByRole("status")).toHaveTextContent("mock-report.xlsx");

    // The company import is only for types — no unused import.
    expect(emptyCompany.name).toBe("");
  });

  it("verlangt Project name und Datei vor der Berechnung", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/project name/i);
  });

  it("shows a pending state while the calculation runs", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const original = adapter.calculate.bind(adapter);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(adapter, "calculate").mockImplementation(async (input) => {
      await gate;
      return original(input);
    });

    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Pending-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    const pending = await screen.findByRole("button", { name: "Calculating …" });
    expect(pending).toBeDisabled();

    release();
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());
  });

  it("clears the result when a cost input changes", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Stale-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());

    await user.type(screen.getByLabelText("Print time (h)"), "3");
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
  });

  it("asks before discarding unsaved changes", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Draft");

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/unsaved changes/i);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByPlaceholderText("e.g. Enclosure series")).toHaveValue("Draft");

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    const dialogAgain = await screen.findByRole("dialog");
    await user.click(within(dialogAgain).getByRole("button", { name: "Discard" }));

    expect(screen.getByPlaceholderText("e.g. Enclosure series")).toHaveValue("");
  });

  it("applies a saved profile and keeps the advanced fields collapsed", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const profile: CalculationProfile = {
      id: newId(),
      name: "Standard 19",
      fail_rate_percent: "2",
      tax_rate_percent: "19",
      margin_percent: "25",
      handling_fee: "0",
      handling_fee_scope: "once",
      energy_price_per_kwh: "0.35",
      apply_energy_costs: true,
      power_level_percent: "100",
      combine_materials: false,
      multiply_print_time_with_quantity: true,
      print_time_factor: "1",
      exclude_machine_from_margin: false,
      exclude_material_from_margin: false,
      exclude_worksteps_from_margin: false,
    };
    await adapter.saveCalculationProfile(profile);

    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);
    await user.click(screen.getByRole("button", { name: "New calculation" }));

    const select = screen.getByRole("combobox", { name: "Calculation profile" });
    await screen.findByRole("option", { name: "Standard 19" });
    await user.selectOptions(select, profile.id);

    expect(screen.getByText("25 %")).toBeInTheDocument();
    expect(screen.queryByLabelText("Margin (%)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.getByLabelText("Margin (%)")).toHaveValue("25");
  });
});
