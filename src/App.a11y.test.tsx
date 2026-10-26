import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { MockPlatformAdapter } from "./api/mockAdapter";
import { newId } from "./api/types";

async function expectNoViolations(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
    rules: {
      // jsdom has no layout/canvas, so contrast cannot be measured.
      "color-contrast": { enabled: false },
    },
  });
  expect(results.violations).toEqual([]);
}

async function seed(adapter: MockPlatformAdapter) {
  await adapter.savePrinter({
    id: newId(),
    model: "MK4",
    manufacturer: null,
    process: "fdm",
    material_family: "filament",
    power_watts: "110",
    build_width_mm: "250",
    build_depth_mm: "210",
    build_height_mm: "220",
    purchase_price: "799",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
    properties: {},
  });
}

describe("accessibility", () => {
  it("has no WCAG A/AA violations in the empty calculation view", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const { container } = render(<App adapter={adapter} />);

    await screen.findByRole("button", { name: "New calculation" });
    await expectNoViolations(container);
  });

  it("has no WCAG A/AA violations in the open calculation form", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    const { container } = render(<App adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.click(screen.getByRole("button", { name: "Customize" }));

    await waitFor(() => expect(screen.getByLabelText("Failure rate (%)")).toBeInTheDocument());
    await expectNoViolations(container);
  });

  it("has no WCAG A/AA violations in a modal dialog", async () => {
    const adapter = new MockPlatformAdapter();
    await seed(adapter);
    const user = userEvent.setup();
    const { container } = render(<App adapter={adapter} />);

    await user.click(await screen.findByRole("button", { name: "New calculation" }));
    await user.type(screen.getByPlaceholderText("e.g. Enclosure series"), "A11y");
    await user.click(screen.getByRole("button", { name: "New calculation" }));

    await screen.findByRole("dialog");
    await expectNoViolations(container);
  });
});
