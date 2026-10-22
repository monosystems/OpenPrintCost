import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { de } from "../i18n/de";
import { newId } from "../api/types";
import { WorkstepView } from "./WorkstepView";

describe("WorkstepView", () => {
  it("verlangt zuerst eine Kategorie", async () => {
    const user = userEvent.setup();
    render(<WorkstepView adapter={new MockPlatformAdapter()} />);
    await waitFor(() => expect(screen.queryByText(de.common.loading)).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: de.worksteps.newButton }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/zuerst eine Kategorie/);
  });

  it("legt Kategorie und Arbeitsschritt an", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<WorkstepView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText(de.common.loading)).not.toBeInTheDocument());

    await user.type(screen.getByLabelText(de.worksteps.category), "Nachbearbeitung");
    await user.click(screen.getByRole("button", { name: de.common.add }));
    await waitFor(() => expect(screen.getByText("Nachbearbeitung")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: de.worksteps.newButton }));
    await user.type(screen.getByPlaceholderText(de.worksteps.nameExample), "Entstutzung");
    await user.click(screen.getByRole("button", { name: de.common.save }));

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

    await user.click(
      screen.getByRole("button", { name: de.worksteps.deleteCategoryLabel("Reinigung") }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: de.common.delete }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/noch verwendet/);
    expect(await adapter.listWorkstepCategories()).toHaveLength(1);
  });
});
