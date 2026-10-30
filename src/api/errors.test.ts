import { describe, expect, it } from "vitest";
import { localizeErrorMessage } from "./errors";

describe("localizeErrorMessage", () => {
  it("translates known validation and storage errors", () => {
    expect(localizeErrorMessage("Feld 'print_time_hours' darf nicht negativ sein", "en")).toBe(
      "Field 'print_time_hours' must not be negative.",
    );
    expect(
      localizeErrorMessage("Feld 'fail_rate_percent' muss zwischen 0 und 100 liegen", "en"),
    ).toBe("Field 'fail_rate_percent' must be between 0 and 100.");
    expect(localizeErrorMessage("Division durch null im Feld 'package_size'", "en")).toBe(
      "Division by zero in field 'package_size'.",
    );
    expect(localizeErrorMessage("Speicherfehler: database is locked", "en")).toBe(
      "Storage error: database is locked",
    );
    expect(
      localizeErrorMessage("Datei '/tmp/a.stl' konnte nicht gelesen werden: permission denied", "en"),
    ).toBe("File '/tmp/a.stl' could not be read: permission denied");
    expect(
      localizeErrorMessage(
        "Datei '/tmp/a.stl' konnte nicht geschrieben werden: permission denied",
        "en",
      ),
    ).toBe("File '/tmp/a.stl' could not be written: permission denied");
  });

  it("translates field errors behind the InvalidInput prefix", () => {
    expect(
      localizeErrorMessage(
        "Ungültige Eingabe: Feld 'print_time_hours' darf nicht negativ sein",
        "en",
      ),
    ).toBe("Field 'print_time_hours' must not be negative.");
    expect(
      localizeErrorMessage(
        "Ungültige Eingabe: Feld 'fail_rate_percent' muss zwischen 0 und 100 liegen",
        "en",
      ),
    ).toBe("Field 'fail_rate_percent' must be between 0 and 100.");
  });

  it("leaves German messages untouched in German", () => {
    expect(localizeErrorMessage("Feld 'x' darf nicht negativ sein", "de")).toBe(
      "Feld 'x' darf nicht negativ sein",
    );
  });

  it("keeps unknown messages as a fallback", () => {
    expect(localizeErrorMessage("Etwas ganz anderes", "en")).toBe("Etwas ganz anderes");
  });
});
