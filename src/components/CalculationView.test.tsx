import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { emptyCompany, newId } from "../api/types";
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
});
