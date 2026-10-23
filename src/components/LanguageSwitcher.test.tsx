import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "../i18n";
import { LanguageSwitcher } from "./LanguageSwitcher";

/** The trigger's accessible name is localized, so match both variants. */
const TRIGGER_NAME = /^(Language|Sprache)$/;

function renderSwitcher(locale: "en" | "de" = "en") {
  return render(
    <LanguageProvider initial={locale}>
      <LanguageSwitcher />
    </LanguageProvider>,
  );
}

describe("LanguageSwitcher", () => {
  it("shows the current language behind a button", async () => {
    const user = userEvent.setup();
    renderSwitcher("en");

    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    expect(trigger).toHaveTextContent("English");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Deutsch" })).toBeInTheDocument();
  });

  it("switches the language and closes the list", async () => {
    const user = userEvent.setup();
    renderSwitcher("en");

    await user.click(screen.getByRole("button", { name: TRIGGER_NAME }));
    await user.click(screen.getByRole("option", { name: "Deutsch" }));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: TRIGGER_NAME })).toHaveTextContent("Deutsch");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderSwitcher("en");

    const trigger = screen.getByRole("button", { name: TRIGGER_NAME });
    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
