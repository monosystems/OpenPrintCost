import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { newId } from "../api/types";
import { WorkstepView } from "./WorkstepView";

describe("WorkstepView", () => {
  it("verlangt zuerst eine Kategorie", async () => {
    const user = userEvent.setup();
    render(<WorkstepView adapter={new MockPlatformAdapter()} />);
    await waitFor(() => expect(screen.queryByText("Wird geladen …")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Neuer Arbeitsschritt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/zuerst eine Kategorie/);
  });

  it("legt Kategorie und Arbeitsschritt an", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<WorkstepView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Wird geladen …")).not.toBeInTheDocument());

    await user.type(screen.getByLabelText("Neue Kategorie"), "Nachbearbeitung");
    await user.click(screen.getByRole("button", { name: "Hinzufügen" }));
    await waitFor(() => expect(screen.getByText("Nachbearbeitung")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Neuer Arbeitsschritt" }));
    await user.type(screen.getByPlaceholderText("z. B. Entstutzung"), "Entstutzung");
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(screen.getByText("Entstutzung")).toBeInTheDocument());
    expect(await adapter.listWorksteps()).toHaveLength(1);
  });

  it("zeigt einen Hinweis beim Löschen benutzter Kategorien", async () => {
    const adapter = new MockPlatformAdapter();
    const category = { id: newId(), name: "Reinigung", color: null };
    await adapter.saveWorkstepCategory(category);
    await adapter.saveWorkstep({
      id: newId(),
      name: "Waschen",
      category,
      calculation_type: "per-piece",
      price: "1",
      quantity: "1",
      duration_hours: "0",
      timing: "other",
    });

    const user = userEvent.setup();
    render(<WorkstepView adapter={adapter} />);
    await waitFor(() => expect(screen.getByText("Reinigung")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Kategorie Reinigung löschen" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Löschen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/noch verwendet/);
    expect(await adapter.listWorkstepCategories()).toHaveLength(1);
  });
});
