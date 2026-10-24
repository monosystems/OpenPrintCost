import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("SettingsView updates", () => {
  it("shows the running version from the backend", async () => {
    const adapter = new MockPlatformAdapter();
    adapter.appVersion = "9.8.7";
    render(<SettingsView adapter={adapter} />);

    await waitFor(() =>
      expect(screen.getByText("Installed version: 9.8.7")).toBeInTheDocument(),
    );
  });

  it("reports that the running version is current", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<SettingsView adapter={adapter} />);

    await user.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "You are running the latest version.",
    );
  });

  it("offers an available update and installs it", async () => {
    const adapter = new MockPlatformAdapter();
    const offered = {
      version: "0.2.0",
      currentVersion: "0.1.1",
      notes: "Faster calculations.",
      date: "2026-10-24T07:00:00Z",
    };
    adapter.availableUpdate = offered;
    const onUpdateChange = vi.fn();
    const user = userEvent.setup();
    render(<SettingsView adapter={adapter} onUpdateChange={onUpdateChange} />);

    await user.click(screen.getByRole("button", { name: "Check for updates" }));

    expect(await screen.findByText("Version 0.2.0 is available.")).toBeInTheDocument();
    expect(screen.getByText("Faster calculations.")).toBeInTheDocument();
    expect(onUpdateChange).toHaveBeenCalledWith(offered);

    await user.click(screen.getByRole("button", { name: "Install update" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Update installed");
    expect(onUpdateChange).toHaveBeenLastCalledWith(null);
  });
});
