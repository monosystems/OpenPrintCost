import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import {
  emptyCompany,
  newId,
  type CalculationProfile,
  type Workstep,
  type WorkstepCategory,
} from "../api/types";
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
      build_width_mm: "100",
      build_depth_mm: "100",
      build_height_mm: "100",
      purchase_price: "799",
      hourly_rate: null,
      nozzle_wear_cost: null,
      build_plate_wear_cost: null,
      material_change_cost: "2.5",
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
    adapter.saveMaterial({
      id: newId(),
      name: "PLA",
      material_type: "PLA",
      family: "filament",
      manufacturer: null,
      shop_link: null,
      density_g_cm3: "1.24",
      package_size: "1",
      unit: "kg",
      price: "25",
      properties: {},
    }),
  ]);
}

const tauriWindow = vi.hoisted(() => ({
  handler: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    onCloseRequested: async (handler: (event: { preventDefault: () => void }) => void) => {
      tauriWindow.handler = handler;
      return () => undefined;
    },
  }),
}));

async function addMaterial(
  user: ReturnType<typeof userEvent.setup>,
  fileCard: HTMLElement,
  name: string,
) {
  const select = within(fileCard).getByLabelText("Choose material");
  const option = within(select).getByRole("option", { name });
  await user.selectOptions(select, (option as HTMLOptionElement).value);
  await user.click(within(fileCard).getByRole("button", { name: "Add" }));
}

describe("CalculationView", () => {
  it("calculates and shows the result", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
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
    expect(screen.getByText("Selling price", { selector: "h4" })).toBeInTheDocument();
  });

  it("keeps additional items when their file is removed", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Orphan-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.type(await screen.findByLabelText("File name"), "A.stl");

    const itemsSection = screen
      .getByRole("heading", { name: "Additional items" })
      .closest("section");
    if (!itemsSection) throw new Error("Items section missing");
    await user.type(within(itemsSection).getByLabelText("Name"), "Verpackung");
    await user.clear(within(itemsSection).getByLabelText("Item price"));
    await user.type(within(itemsSection).getByLabelText("Item price"), "2");
    const target = within(itemsSection).getByLabelText("Assignment");
    const option = within(target).getByRole("option", { name: "A.stl" });
    await user.selectOptions(target, (option as HTMLOptionElement).value);
    await user.click(within(itemsSection).getByRole("button", { name: "Add" }));

    await user.click(screen.getByRole("button", { name: "Remove file A.stl" }));
    expect(screen.getByText("Verpackung")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());

    const summaries = await adapter.listCalculations();
    const saved = summaries.find((entry) => entry.project_name === "Orphan-Test");
    if (!saved) throw new Error("Saved calculation missing");
    const stored = await adapter.getCalculation(saved.id);
    expect(stored.document.files).toHaveLength(0);
    expect(stored.document.additional_items).toHaveLength(1);
    expect(stored.document.additional_items[0]?.file_id).toBeNull();
  });

  it("accepts comma decimals and normalizes them before calculating", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Comma-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const printTime = await screen.findByLabelText("Print time (h)");
    await user.clear(printTime);
    await user.type(printTime, "0,5");
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());
    expect(screen.getByLabelText("Print time (h)")).toHaveValue("0.5");
  });

  it("normalizes decimals before exporting JSON", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const exportJson = vi.spyOn(adapter, "exportCalculationJson");
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Export-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const printTime = await screen.findByLabelText("Print time (h)");
    await user.clear(printTime);
    await user.type(printTime, "0,5");
    await user.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => expect(exportJson).toHaveBeenCalled());
    expect(exportJson.mock.calls[0]?.[0].files[0]?.print_time_hours).toBe("0.5");
    expect(exportJson.mock.calls[0]?.[0].created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("keeps a negative dimension visible to validation", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Dimension-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const width = await screen.findByLabelText("Width X");
    await user.clear(width);
    await user.type(width, "-5");
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/must not be negative/i);
  });

  it("rejects a negative print time with a localized error", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Negative-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const printTime = await screen.findByLabelText("Print time (h)");
    await user.clear(printTime);
    await user.type(printTime, "-1");
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/must not be negative/i);
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
  });

  it("reports an empty required decimal instead of a backend parse error", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Empty-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Customize" }));
    await user.clear(screen.getByLabelText("Margin (%)"));
    await user.click(screen.getByRole("button", { name: "Calculate" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Margin \(%\)/i);
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
  });

  it("groups the calculation form into labelled sections", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));

    for (const name of [
      "Project & printer",
      "Calculation profile",
      "Files",
      "Work steps",
      "Additional items",
      "Percentage surcharges",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("takes the G-code print time and filament volume from the import", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import G-code" }));

    await waitFor(() => {
      expect(within(fileCard).getByLabelText("File name")).toHaveValue("demo");
      expect(within(fileCard).getByLabelText("Print time (h)")).toHaveValue("2.5");
      expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("2.88634");
    });
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/PrusaSlicer detected/);
    expect(toast).toHaveTextContent(/2\.886 cm³ filament volume taken/);
  });

  it("turns a multi-object 3MF into per-piece values", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    vi.spyOn(adapter, "import3mfFile").mockResolvedValue({
      volume_cm3: "10",
      dimensions_mm: ["20", "20", "20"],
      object_count: 2,
      material_names: ["PLA"],
      estimated_time_hours: "4",
      filament_volumes_cm3: ["3.6075"],
      detected_slicer: "BambuStudio",
    });
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Plate-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import 3MF" }));

    await waitFor(() =>
      expect(within(fileCard).getByLabelText("Quantity")).toHaveValue("2"),
    );
    expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("5");
    expect(within(fileCard).getByLabelText("Print time (h)")).toHaveValue("2");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(async () => expect(await adapter.listCalculations()).toHaveLength(1));
    const summary = (await adapter.listCalculations())[0];
    if (!summary) throw new Error("Saved calculation missing");
    const stored = await adapter.getCalculation(summary.id);
    const file = stored.document.files[0];
    expect(file?.quantity).toBe(2);
    expect(file?.volume_cm3).toBe("5");
    expect(file?.print_time_hours).toBe("2");
    expect(file?.filament_volumes_cm3).toEqual(["1.80375"]);
  });

  it("keeps plate print time when quantity multiplication is disabled", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    vi.spyOn(adapter, "import3mfFile").mockResolvedValue({
      volume_cm3: "10",
      dimensions_mm: ["20", "20", "20"],
      object_count: 2,
      material_names: ["PLA"],
      estimated_time_hours: "4",
      filament_volumes_cm3: ["3.6075"],
      detected_slicer: "BambuStudio",
    });
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Customize" }));
    const multiply = screen.getByRole("checkbox", { name: "Print time × quantity" });
    expect(multiply).toBeChecked();
    await user.click(multiply);

    await user.click(screen.getByRole("button", { name: "Add file" }));
    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import 3MF" }));

    await waitFor(() => expect(within(fileCard).getByLabelText("Quantity")).toHaveValue("2"));
    expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("5");
    expect(within(fileCard).getByLabelText("Print time (h)")).toHaveValue("4");
  });

  it("keeps an existing print time when a 3MF has no estimate", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    vi.spyOn(adapter, "import3mfFile").mockResolvedValue({
      volume_cm3: "5",
      dimensions_mm: ["10", "10", "10"],
      object_count: 1,
      material_names: [],
      estimated_time_hours: null,
      filament_volumes_cm3: [],
      detected_slicer: "BambuStudio",
    });
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));
    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    const printTime = within(fileCard).getByLabelText("Print time (h)");
    await user.clear(printTime);
    await user.type(printTime, "3.5");

    await user.click(within(fileCard).getByRole("button", { name: "Import 3MF" }));

    await waitFor(() =>
      expect(within(fileCard).getByLabelText("Print time (h)")).toHaveValue("3.5"),
    );
    expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("5");
  });

  it("asks before a G-code import replaces manual materials", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    vi.spyOn(adapter, "importGcodeFile").mockResolvedValue({
      time_from_comments_hours: "1",
      simulated_time_hours: "1",
      used_comments: true,
      filaments: [{ length_mm: "1000", diameter_mm: "1.75", volume_mm3: "2405" }],
      layer_count: 40,
      detected_slicer: "PrusaSlicer",
    });
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));
    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await addMaterial(user, fileCard, "PLA");
    expect(
      within(fileCard).getByRole("button", { name: "Remove material PLA" }),
    ).toBeInTheDocument();

    await user.click(within(fileCard).getByRole("button", { name: "Import G-code" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/manual material assignments/i);
    await user.click(within(dialog).getByRole("button", { name: "Replace" }));

    await waitFor(() =>
      expect(within(fileCard).getByText("Imported filaments")).toBeInTheDocument(),
    );
    expect(
      within(fileCard).queryByRole("button", { name: "Remove material PLA" }),
    ).not.toBeInTheDocument();
  });

  it("sums multiple filament volumes and assigns materials per filament", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    vi.spyOn(adapter, "importGcodeFile").mockResolvedValue({
      time_from_comments_hours: "2.5",
      simulated_time_hours: "2.6",
      used_comments: true,
      filaments: [
        { length_mm: "1000", diameter_mm: "1.75", volume_mm3: "2405" },
        { length_mm: "500", diameter_mm: "1.75", volume_mm3: "1202.5" },
      ],
      layer_count: 120,
      detected_slicer: "PrusaSlicer",
    });
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import G-code" }));

    await waitFor(() =>
      expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("3.6075"),
    );
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/2 filaments detected/);
    expect(toast).toHaveTextContent(/3\.608 cm³ total taken/);
    expect(within(fileCard).getByText("Imported filaments")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Multi");
    const firstFilament = within(fileCard).getByLabelText("Material for filament 1");
    const petg = within(firstFilament).getByRole("option", { name: "PETG" });
    await user.selectOptions(firstFilament, (petg as HTMLOptionElement).value);

    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Assign all imported filaments/,
    );
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();

    const secondFilament = within(fileCard).getByLabelText("Material for filament 2");
    const pla = within(secondFilament).getByRole("option", { name: "PLA" });
    await user.selectOptions(secondFilament, (pla as HTMLOptionElement).value);

    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(async () => {
      expect(await adapter.listCalculations()).toHaveLength(1);
    });
    const list = await adapter.listCalculations();
    const entry = list[0];
    if (!entry) throw new Error("Saved calculation missing");
    const stored = await adapter.getCalculation(entry.id);
    const file = stored.document.files[0];
    if (!file) throw new Error("Saved file missing");

    expect(stored.document.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(file.filament_volumes_cm3).toEqual(["2.405", "1.2025"]);
    expect(file.materials.map((material) => material.material.name)).toEqual(["PETG", "PLA"]);
    expect(file.materials.map((material) => material.volume_cm3)).toEqual(["2.405", "1.2025"]);
    expect(file.materials.map((material) => material.filament_index)).toEqual([0, 1]);
  });

  it("requires a weight or volume for every material in a multi-material file", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Multi");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await addMaterial(user, fileCard, "PETG");
    await addMaterial(user, fileCard, "PLA");

    expect(
      within(fileCard).getByText(/multiple materials, enter a weight or volume/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Assign a weight or volume to every material/,
    );
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();

    const weights = within(fileCard).getAllByLabelText("Weight per material (g)");
    const petgWeight = weights[0];
    const plaWeight = weights[1];
    if (!petgWeight || !plaWeight) throw new Error("Material weight inputs missing");
    await user.type(petgWeight, "6");
    await user.type(plaWeight, "4");

    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());
  });

  it("saves per-material volumes and the material change count", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Multi");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await addMaterial(user, fileCard, "PETG");
    await addMaterial(user, fileCard, "PLA");

    const volumes = within(fileCard).getAllByLabelText("Volume per material (cm³)");
    const petgVolume = volumes[0];
    const plaVolume = volumes[1];
    if (!petgVolume || !plaVolume) throw new Error("Material volume inputs missing");
    await user.type(petgVolume, "6");
    await user.type(plaVolume, "4");

    const materialChanges = within(fileCard).getByLabelText("Material changes");
    await user.clear(materialChanges);
    await user.type(materialChanges, "3");

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(async () => {
      expect(await adapter.listCalculations()).toHaveLength(1);
    });
    const list = await adapter.listCalculations();
    const entry = list[0];
    if (!entry) throw new Error("Saved calculation missing");
    const stored = await adapter.getCalculation(entry.id);
    const file = stored.document.files[0];
    if (!file) throw new Error("Saved file missing");

    expect(file.materials.map((material) => material.volume_cm3)).toEqual(["6", "4"]);
    expect(file.material_changes).toBe(3);
  });

  it("exports the result and shows the path", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const exportPdf = vi.spyOn(adapter, "exportResultPdf");
    const exportExcel = vi.spyOn(adapter, "exportResultExcel");
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Export-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(await screen.findByRole("status")).toHaveTextContent("mock-report.pdf");
    expect(exportPdf.mock.calls[0]?.[2]).toBe("en");

    await user.click(screen.getByRole("button", { name: "Export Excel" }));
    expect(await screen.findByRole("status")).toHaveTextContent("mock-report.xlsx");
    expect(exportExcel.mock.calls[0]?.[2]).toBe("en");

    // The company import is only for types — no unused import.
    expect(emptyCompany.name).toBe("");
  });

  it("verlangt Project name und Datei vor der Berechnung", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
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

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
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

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Stale-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());

    await user.type(screen.getByLabelText("Print time (h)"), "3");
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
  });

  it("backfills created_at when loading an old calculation", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const exportJson = vi.spyOn(adapter, "exportCalculationJson");
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Old");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());

    const summary = (await adapter.listCalculations()).find((entry) => entry.project_name === "Old");
    if (!summary) throw new Error("Saved calculation missing");
    const stored = await adapter.getCalculation(summary.id);
    await adapter.saveCalculation({ ...stored.document, created_at: null });
    const reloaded = await adapter.getCalculation(summary.id);

    await user.click(await screen.findByRole("button", { name: /^Old/ }));
    await user.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => expect(exportJson).toHaveBeenCalled());
    expect(exportJson.mock.calls.at(-1)?.[0].created_at).toBe(reloaded.created_at);
  });

  it("asks the Tauri close handler before closing a dirty calculation", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    try {
      await user.click(await screen.findByRole("button", { name: "New calculation" }));
      await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Close-Test");
      await user.click(screen.getByRole("button", { name: "Add file" }));
      await waitFor(() => expect(tauriWindow.handler).toBeTypeOf("function"));

      const blocked = { preventDefault: vi.fn() };
      tauriWindow.handler?.(blocked);
      expect(blocked.preventDefault).toHaveBeenCalled();

      confirm.mockReturnValue(true);
      const allowed = { preventDefault: vi.fn() };
      tauriWindow.handler?.(allowed);
      expect(allowed.preventDefault).not.toHaveBeenCalled();
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
      confirm.mockRestore();
    }
  });

  it("warns before unloading a dirty calculation", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Dirty");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());

    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });

  it("keeps a selected workstep visible after it is deleted from master data", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const category: WorkstepCategory = { id: newId(), name: "Finishing", color: null };
    await adapter.saveWorkstepCategory(category);
    const workstep: Workstep = {
      id: newId(),
      name: "Entgraten",
      category,
      calculation_type: "per-piece",
      price: "2",
      quantity: "1",
      duration_hours: "0",
      timing: "after",
    };
    await adapter.saveWorkstep(workstep);

    const user = userEvent.setup();
    const { rerender } = render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Snapshot-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(await screen.findByRole("checkbox", { name: /Entgraten/ }));

    await adapter.deleteWorkstep(workstep.id);
    rerender(<CalculationView adapter={adapter} active={false} />);
    rerender(<CalculationView adapter={adapter} active />);

    const checkbox = await screen.findByRole("checkbox", { name: /Entgraten/ });
    expect(checkbox).toBeChecked();
    expect(screen.getByText(/saved snapshot/)).toBeInTheDocument();
  });

  it("ignores a stale calculation result after an edit", async () => {
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

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Race-Test");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await screen.findByRole("button", { name: "Calculating …" });

    const printTime = screen.getByLabelText("Print time (h)");
    await user.clear(printTime);
    await user.type(printTime, "3");

    release();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Calculate" })).toBeEnabled(),
    );
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Print time (h)")).toHaveValue("3");
  });

  it("keeps edits made while a save is running", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const original = adapter.saveCalculation.bind(adapter);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(adapter, "saveCalculation").mockImplementation(async (input) => {
      await gate;
      return original(input);
    });

    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Save-Race");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const printTime = await screen.findByLabelText("Print time (h)");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("button", { name: "Saving …" });

    await user.clear(printTime);
    await user.type(printTime, "7");

    release();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
    expect(screen.getByLabelText("Print time (h)")).toHaveValue("7");
  });

  it("asks before replacing a dirty draft with a saved calculation", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Saved");
    await user.click(screen.getByRole("button", { name: "Add file" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Draft");

    const savedEntry = await screen.findByRole("button", { name: /^Saved/ });
    await user.click(savedEntry);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/unsaved changes/i);
    await user.click(within(dialog).getByRole("button", { name: "Discard" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Enclosure series")).toHaveValue("Saved"),
    );
  });

  it("asks before discarding unsaved changes", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Draft");

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(/unsaved changes/i);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByPlaceholderText("e.g. Enclosure series")).toHaveValue("Draft");

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
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
    await user.click(await screen.findByRole("button", { name: "New calculation" }));

    const select = screen.getByRole("combobox", { name: "Profile" });
    await screen.findByRole("option", { name: "Standard 19" });
    await user.selectOptions(select, profile.id);

    expect(screen.getByText("25 %")).toBeInTheDocument();
    expect(screen.queryByLabelText("Margin (%)")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.getByLabelText("Margin (%)")).toHaveValue("25");
  });

  it("imports STL dimensions and warns when the part exceeds the build volume", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import STL" }));

    await waitFor(() => {
      expect(within(fileCard).getByLabelText("File name")).toHaveValue("demo");
      expect(within(fileCard).getByLabelText("Width X")).toHaveValue("40");
    });
    expect(within(fileCard).getByLabelText("Depth Y")).toHaveValue("30");
    expect(within(fileCard).getByLabelText("Height Z")).toHaveValue("25");
    expect(within(fileCard).getByText("Fits — largest axis at 40 %")).toBeInTheDocument();

    const width = within(fileCard).getByLabelText("Width X");
    await user.clear(width);
    await user.type(width, "150");
    expect(
      await within(fileCard).findByText("Exceeds build volume (X)"),
    ).toBeInTheDocument();
  });

  it("imports a 3MF project with time, dimensions and material", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import 3MF" }));

    await waitFor(() => {
      expect(within(fileCard).getByLabelText("File name")).toHaveValue("demo");
      expect(within(fileCard).getByLabelText("Print time (h)")).toHaveValue("2.5");
      expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("12.4");
      expect(within(fileCard).getByLabelText("Width X")).toHaveValue("40");
      expect(within(fileCard).getByLabelText("Depth Y")).toHaveValue("30");
      expect(within(fileCard).getByLabelText("Height Z")).toHaveValue("25");
    });

    expect(within(fileCard).getByText("PLA")).toBeInTheDocument();
    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent(/BambuStudio detected/);
    expect(toast).toHaveTextContent(/1 object read from 3MF/);
    expect(toast).toHaveTextContent(/12\.4 cm³ filament volume taken/);

    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "3MF-Test");
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    await waitFor(() => expect(screen.getByText(/Result:/)).toBeInTheDocument());
  });

  it("requires every imported 3MF filament to be assigned before calculating", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    vi.spyOn(adapter, "import3mfFile").mockResolvedValue({
      volume_cm3: "3",
      dimensions_mm: ["10", "10", "10"],
      object_count: 2,
      material_names: ["PLA", "PETG"],
      estimated_time_hours: "1",
      filament_volumes_cm3: ["1.5", "1.5"],
      detected_slicer: "OrcaSlicer",
    });
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import 3MF" }));
    await waitFor(() =>
      expect(within(fileCard).getByLabelText("Volume (cm³)")).toHaveValue("1.5"),
    );

    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "3MF-Multi");
    await user.click(screen.getByRole("button", { name: "Calculate" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Assign all imported filaments/,
    );
    expect(screen.queryByText(/Result:/)).not.toBeInTheDocument();
  });

  it("treats a cancelled import dialog as a no-op", async () => {
    const adapter = new MockPlatformAdapter();
    vi.spyOn(adapter, "pickImportFile").mockResolvedValue(null);
    const importGcode = vi.spyOn(adapter, "importGcodeFile");
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Add file" }));

    const fileCard = (await screen.findByLabelText("File name")).closest("li");
    if (!fileCard) throw new Error("File card missing");
    await user.click(within(fileCard).getByRole("button", { name: "Import G-code" }));

    expect(importGcode).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("exports and imports a calculation as JSON", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    render(<CalculationView adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Transfer");
    await user.click(screen.getByRole("button", { name: "Add file" }));

    await user.click(screen.getByRole("button", { name: "Export JSON" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Transfer.json"),
    );

    const project = screen.getByPlaceholderText("e.g. Enclosure series");
    await user.clear(project);
    await user.type(project, "Changed");

    await user.click(screen.getByRole("button", { name: "Import JSON" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Import" }));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("e.g. Enclosure series")).toHaveValue("Transfer"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/Transfer.*imported/);
  });
});
