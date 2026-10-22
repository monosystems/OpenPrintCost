import { describe, expect, it } from "vitest";
import { de } from "./de";

/**
 * Structural test of the dictionary: every entry is a non-empty string
 * (or a function/nested object of the same shape). Catches accidentally
 * emptied texts. Cross-locale parity with `en` is covered in
 * `locales.test.tsx`.
 */
function assertFilled(value: unknown, path: string): void {
  if (typeof value === "string") {
    expect(value.length, `empty text: ${path}`).toBeGreaterThan(0);
    return;
  }
  if (typeof value === "function") return;
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertFilled(child, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`unexpected dictionary entry: ${path}`);
}

describe("i18n dictionary", () => {
  it("contains only filled texts", () => {
    assertFilled(de, "de");
  });

  it("covers all sections", () => {
    expect(Object.keys(de)).toEqual(
      expect.arrayContaining([
        "app",
        "common",
        "validation",
        "errors",
        "printers",
        "materials",
        "worksteps",
        "rates",
        "profiles",
        "calculation",
        "settings",
      ]),
    );
  });
});
