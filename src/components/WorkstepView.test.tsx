import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { en } from "../i18n/en";
import { newId } from "../api/types";
import { WorkstepView } from "./WorkstepView";

describe("WorkstepView", () => {
  it("verlangt create a category first", async () => {
    const user = userEvent.setup();
    render(<WorkstepView adapter={new MockPlatformAdapter()} />);
    await waitFor(() => expect(screen.queryByText(en.common.loading)).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: en.worksteps.newButton }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/create a category first/);
  });

  it("creates a category and a work step", async () => {
    const adapter = new MockPlatformAdapter();
    const user = userEvent.setup();
    render(<WorkstepView adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText(en.common.loading)).not.toBeInTheDocument());

    await user.type(screen.getByLabelText(en.worksteps.category), "Post-processing");
    await user.click(screen.getByRole("button", { name: en.common.add }));
    await waitFor(() => expect(screen.getByText("Post-processing")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: en.worksteps.newButton }));
    await user.type(screen.getByPlaceholderText(en.worksteps.nameExample), "Support removal");
    await user.click(screen.getByRole("button", { name: en.common.save }));

    await waitFor(() => expect(screen.getByText("Support removal")).toBeInTheDocument());
    expect(await adapter.listWorksteps()).toHaveLength(1);
  });

  it("zeigt einen Hinweis beim Delete benutzter Kategorien", async () => {
    const adapter = new MockPlatformAdapter();
    const category = { id: newId(), name: "Cleaning", color: null };
    await adapter.saveWorkstepCategory(category);
    await adapter.saveWorkstep({
      id: newId(),
      name: "Washing",
      category,
      calculation_type: "per-piece",
      price: "1",
      quantity: "1",
      duration_hours: "0",
      timing: "other",
    });

    const user = userEvent.setup();
    render(<WorkstepView adapter={adapter} />);
    const deleteCategory = await screen.findByRole("button", {
      name: en.worksteps.deleteCategoryLabel("Cleaning"),
    });
    await user.click(deleteCategory);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: en.common.delete }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/still in use/);
    expect(await adapter.listWorkstepCategories()).toHaveLength(1);
  });
});
