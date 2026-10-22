import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  it("shows and saves company info", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<SettingsView adapter={adapter} />);

    await user.type(screen.getByLabelText("Company name"), "Example Ltd");
    await user.type(screen.getByLabelText("Email"), "info@example.invalid");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("saved"));
    expect(await adapter.getCompanyInfo()).toMatchObject({
      name: "Example Ltd",
      email: "info@example.invalid",
    });
  });

  it("loads saved company info", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.saveCompanyInfo({
      name: "Existing",
      street: "Main St 1",
      zip_city: "12345 Town",
      email: "",
    });
    render(<SettingsView adapter={adapter} />);

    await waitFor(() => expect(screen.getByLabelText("Company name")).toHaveValue("Existing"));
  });
});
