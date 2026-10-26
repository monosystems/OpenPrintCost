import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../i18n";
import { Modal } from "./ui";

function Harness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <LanguageProvider initial="en">
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      {open ? (
        <Modal title="Test dialog" onClose={() => setOpen(false)}>
          <label>
            Field
            <input />
          </label>
          <button type="button">Apply</button>
        </Modal>
      ) : null}
    </LanguageProvider>
  );
}

describe("Modal focus management", () => {
  it("keeps focus inside the dialog and wraps at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness initiallyOpen />);

    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close" });
    const apply = screen.getByRole("button", { name: "Apply" });

    expect(close).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText("Field")).toHaveFocus();
    await user.tab();
    expect(apply).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(apply).toHaveFocus();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Open dialog" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
