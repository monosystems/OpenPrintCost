import { describe, expect, it } from "vitest";
import { de } from "./de";

/**
 * Strukturtest des Wörterbuchs: Jeder Eintrag ist ein nicht-leerer String
 * (oder eine Funktion/verschachteltes Objekt derselben Form). Fängt
 * versehentlich geleerte Texte ab.
 */
function assertFilled(value: unknown, path: string): void {
  if (typeof value === "string") {
    expect(value.length, `leerer Text: ${path}`).toBeGreaterThan(0);
    return;
  }
  if (typeof value === "function") return;
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      assertFilled(child, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`unerwarteter Wörterbuch-Eintrag: ${path}`);
}

describe("i18n Wörterbuch", () => {
  it("enthält nur gefüllte Texte", () => {
    assertFilled(de, "de");
  });

  it("deckt alle Bereiche ab", () => {
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
