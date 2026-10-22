import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { SettingsView } from "./SettingsView";

describe("SettingsView", () => {
  it("zeigt und speichert Firmendaten", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<SettingsView adapter={adapter} />);

    await user.type(screen.getByLabelText("Firmenname"), "Muster GmbH");
    await user.type(screen.getByLabelText("E-Mail"), "info@example.invalid");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("gespeichert"));
    expect(await adapter.getCompanyInfo()).toMatchObject({
      name: "Muster GmbH",
      email: "info@example.invalid",
    });
  });

  it("lädt gespeicherte Firmendaten", async () => {
    const adapter = new MockPlatformAdapter();
    await adapter.saveCompanyInfo({
      name: "Bestehend",
      street: "Weg 1",
      zip_city: "12345 Ort",
      email: "",
    });
    render(<SettingsView adapter={adapter} />);

    await waitFor(() => expect(screen.getByLabelText("Firmenname")).toHaveValue("Bestehend"));
  });
});
