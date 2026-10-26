import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { MockPlatformAdapter } from "./api/mockAdapter";
import type { Printer } from "./api/types";

function seedPrinter(adapter: MockPlatformAdapter) {
  return adapter.savePrinter({
    id: "11111111-1111-1111-1111-111111111111",
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
    material_change_cost: null,
    properties: {},
  } satisfies Printer);
}

describe("App footer", () => {
  it("shows the build number instead of the database path", async () => {
    const adapter = new MockPlatformAdapter();
    adapter.appVersion = "9.8.7";
    render(<App adapter={adapter} />);

    expect(await screen.findByText("Build: 9.8.7")).toBeInTheDocument();
    expect(screen.queryByText(/^Database:/)).not.toBeInTheDocument();
  });
});

describe("App workflow", () => {
  it("keeps an in-progress calculation when switching tabs", async () => {
    const adapter = new MockPlatformAdapter();
    await seedPrinter(adapter);
    const user = userEvent.setup();
    render(<App adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "Draft");

    await user.click(screen.getByRole("button", { name: "Printers" }));
    await user.click(screen.getByRole("button", { name: "Calculation" }));

    expect(screen.getByPlaceholderText("e.g. Enclosure series")).toHaveValue("Draft");
  });

  it("guides a fresh install through the setup checklist", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<App adapter={adapter} />);

    expect(await screen.findByText("Set up your workspace")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add printer" }));

    expect(await screen.findByRole("heading", { name: "Printers" })).toBeInTheDocument();
  });
});

describe("App update badge", () => {
  it("appears when the automatic check finds a new version", async () => {
    const adapter = new MockPlatformAdapter();
    adapter.appVersion = "0.1.3";
    adapter.availableUpdate = {
      version: "0.2.0",
      currentVersion: "0.1.3",
      notes: null,
      date: null,
    };
    render(<App adapter={adapter} />);

    expect(
      await screen.findByRole("button", { name: "Update available: version 0.2.0" }),
    ).toBeInTheDocument();
  });

  it("opens the settings tab where the update can be installed", async () => {
    const adapter = new MockPlatformAdapter();
    adapter.availableUpdate = {
      version: "0.2.0",
      currentVersion: "0.1.3",
      notes: null,
      date: null,
    };
    const user = userEvent.setup();
    render(<App adapter={adapter} />);

    await user.click(
      await screen.findByRole("button", { name: "Update available: version 0.2.0" }),
    );

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Check for updates" }),
    ).toBeInTheDocument();
  });

  it("stays hidden while the running version is current", async () => {
    const adapter = new MockPlatformAdapter();
    const check = vi.spyOn(adapter, "checkForUpdate");
    render(<App adapter={adapter} />);

    await waitFor(() => expect(check).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^Update available/ })).not.toBeInTheDocument();
  });
});
