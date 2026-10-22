import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { de } from "./de";
import { en } from "./en";
import { detectLocale, LanguageProvider, resolveLocale, useLocale } from "./LanguageContext";

/** Walks both dictionaries and collects structural mismatches. */
function collectMismatches(a: unknown, b: unknown, path: string, out: string[]): void {
  if (typeof a === "function" || typeof b === "function") {
    if (typeof a !== typeof b) out.push(`type mismatch: ${path}`);
    return;
  }
  if (typeof a === "string" || typeof b === "string") {
    if (typeof a !== "string" || typeof b !== "string") out.push(`type mismatch: ${path}`);
    else if (a.length === 0 || b.length === 0) out.push(`empty string: ${path}`);
    return;
  }
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      const left = (a as Record<string, unknown>)[key];
      const right = (b as Record<string, unknown>)[key];
      if (left === undefined) out.push(`missing in de: ${path}.${key}`);
      else if (right === undefined) out.push(`missing in en: ${path}.${key}`);
      else collectMismatches(left, right, `${path}.${key}`, out);
    }
    return;
  }
  out.push(`type mismatch: ${path}`);
}

describe("locales", () => {
  it("en and de have identical structure and no empty strings", () => {
    const mismatches: string[] = [];
    collectMismatches(de, en, "strings", mismatches);
    expect(mismatches).toEqual([]);
  });

  it("resolveLocale prefers stored values and detects otherwise", () => {
    expect(resolveLocale("de")).toBe("de");
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale(null)).toBe(detectLocale());
    expect(resolveLocale("fr")).toBe(detectLocale());
    expect(["en", "de"]).toContain(detectLocale());
  });

  it("provider supplies the dictionary and switches locale", async () => {
    const user = userEvent.setup();
    function Probe() {
      const { t, locale, setLocale } = useLocale();
      return (
        <div>
          <p>{t.calculation.calculate}</p>
          <button type="button" onClick={() => setLocale(locale === "en" ? "de" : "en")}>
            switch
          </button>
        </div>
      );
    }
    render(
      <LanguageProvider initial="en">
        <Probe />
      </LanguageProvider>,
    );
    expect(screen.getByText("Calculate")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "switch" }));
    expect(screen.getByText("Berechnen")).toBeInTheDocument();
  });
});
