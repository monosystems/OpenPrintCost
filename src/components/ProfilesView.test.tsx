import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { ProfilesView } from "./ProfilesView";

describe("ProfilesView", () => {
  it("creates a profile via the form", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Loading …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New profile" }));
    await user.type(screen.getByPlaceholderText("e.g. Standard 19%"), "Standard 19 %");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Standard 19 %")).toBeInTheDocument());
    expect(await adapter.listCalculationProfiles()).toHaveLength(1);
  });

  it("groups the profile form into labelled sections", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Loading …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New profile" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Profile")).toBeInTheDocument();
    expect(within(dialog).getByText("Calculation")).toBeInTheDocument();
    expect(within(dialog).getByText("Energy")).toBeInTheDocument();
    expect(within(dialog).getByText("Options")).toBeInTheDocument();
    expect(within(dialog).getByText("Fields marked * are required.")).toBeInTheDocument();
  });

  it("rejects a percentage above 100", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Loading …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New profile" }));
    await user.type(screen.getByPlaceholderText("e.g. Standard 19%"), "Ungültig");
    const tax = screen.getByLabelText("Tax rate (%)");
    await user.clear(tax);
    await user.type(tax, "150");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/between 0 and 100/i);
    expect(await adapter.listCalculationProfiles()).toHaveLength(0);
  });

  it("rejects an empty name", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Loading …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "New profile" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/enter a name/);
    expect(await adapter.listCalculationProfiles()).toHaveLength(0);
  });

  it("deletes only after confirmation", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.saveCalculationProfile({
      id: "22222222-2222-2222-2222-222222222222",
      name: "Alt",
      fail_rate_percent: "0",
      tax_rate_percent: "19",
      margin_percent: "0",
      handling_fee: "0",
      handling_fee_scope: "once",
      energy_price_per_kwh: "0.35",
      apply_energy_costs: false,
      power_level_percent: "100",
      combine_materials: false,
      multiply_print_time_with_quantity: true,
      print_time_factor: "1",
      exclude_machine_from_margin: false,
      exclude_material_from_margin: false,
      exclude_worksteps_from_margin: false,
    });

    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    const item = await screen.findByText("Alt");
    const row = item.closest("tr");
    if (!row) throw new Error("Row missing");

    await user.click(within(row).getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Alt")).not.toBeInTheDocument());
    expect(await adapter.listCalculationProfiles()).toHaveLength(0);
  });
});
