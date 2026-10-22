import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { ProfilesView } from "./ProfilesView";

describe("ProfilesView", () => {
  it("legt ein Profil über das Formular an", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Wird geladen …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Neues Profil" }));
    await user.type(screen.getByPlaceholderText("z. B. Standard 19 %"), "Standard 19 %");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(screen.getByText("Standard 19 %")).toBeInTheDocument());
    expect(await adapter.listCalculationProfiles()).toHaveLength(1);
  });

  it("lehnt einen leeren Namen ab", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<ProfilesView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Wird geladen …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Neues Profil" }));
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Bezeichnung/);
    expect(await adapter.listCalculationProfiles()).toHaveLength(0);
  });

  it("löscht erst nach Bestätigung", async () => {
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
    const row = item.closest("li");
    if (!row) throw new Error("Zeile fehlt");

    await user.click(within(row).getByRole("button", { name: "Löschen" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Löschen" }));

    await waitFor(() => expect(screen.queryByText("Alt")).not.toBeInTheDocument());
    expect(await adapter.listCalculationProfiles()).toHaveLength(0);
  });
});
