import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { MaterialView } from "./MaterialView";

async function renderView(adapter = new MockPlatformAdapter()) {
  const user = userEvent.setup();
  render(<MaterialView adapter={adapter} />);
  await waitFor(() => expect(screen.queryByText("Loading …")).not.toBeInTheDocument());
  return { user, adapter };
}

describe("MaterialView", () => {
  it("shows the empty state without materials", async () => {
    await renderView();
    expect(screen.getByText(/No materials yet/)).toBeInTheDocument();
  });

  it("groups the material form into labelled sections", async () => {
    const { user } = await renderView();

    await user.click(screen.getByRole("button", { name: "New material" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Material")).toBeInTheDocument();
    expect(within(dialog).getByText("Technical data")).toBeInTheDocument();
    expect(within(dialog).getByText("Price & sourcing")).toBeInTheDocument();
    expect(within(dialog).getByText("Fields marked * are required.")).toBeInTheDocument();
  });

  it("creates a material via the form", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "New material" }));
    await user.type(screen.getByPlaceholderText("e.g. PETG Black"), "PETG Black");
    await user.type(screen.getByPlaceholderText("e.g. PETG"), "PETG");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("PETG Black")).toBeInTheDocument());
    expect(await adapter.listMaterials()).toHaveLength(1);
  });

  it("rejects an empty name with an error", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: "New material" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Please enter a name.")).toBeInTheDocument();
    expect(await adapter.listMaterials()).toHaveLength(0);
  });
});
