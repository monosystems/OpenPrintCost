import type { Locale } from "../i18n";

/** Aktive Sprache aus dem Dokument (der LanguageProvider setzt `lang`). */
function currentLocale(): Locale {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang === "de" ? "de" : "en";
}

/**
 * Übersetzt bekannte Backend-Fehler ins Englische.
 *
 * Die Fachschicht liefert ihre Meldungen auf Deutsch (die Anwendung ist
 * lokalisiert, die Crates sind sprachneutral gehalten). Unbekannte Meldungen
 * bleiben unverändert, damit keine Information verloren geht.
 */
export function localizeErrorMessage(
  message: string,
  locale: Locale = currentLocale(),
): string {
  if (locale === "de") return message;

  // CalcError::InvalidInput serialisiert als "Ungültige Eingabe: Feld …".
  // Die Feldmuster müssen deshalb auch hinter diesem Präfix greifen.
  const inputBody = message.replace(/^Ungültige Eingabe:\s*/, "");

  const fieldNegative = /^Feld '(.+)' darf nicht negativ sein$/.exec(inputBody);
  if (fieldNegative) return `Field '${fieldNegative[1]}' must not be negative.`;

  const fieldPercent = /^Feld '(.+)' muss zwischen 0 und 100 liegen$/.exec(inputBody);
  if (fieldPercent) return `Field '${fieldPercent[1]}' must be between 0 and 100.`;

  const division = /^Division durch null im Feld '(.+)'$/.exec(inputBody);
  if (division) return `Division by zero in field '${division[1]}'.`;

  const arithmetic = /^Arithmetischer Fehler: (.+)$/.exec(message);
  if (arithmetic) return `Arithmetic error: ${arithmetic[1]}`;

  const invalidInput = /^Ungültige Eingabe: (.+)$/.exec(message);
  if (invalidInput) return `Invalid input: ${invalidInput[1]}`;

  const materialAllocation =
    /^Datei '(.+)': Bei mehreren Materialien muss für jedes Material ein Gewicht oder Volumen angegeben sein$/.exec(
      message,
    );
  if (materialAllocation) {
    return `File '${materialAllocation[1]}': for multiple materials, every material needs a weight or volume.`;
  }

  const notFound = /^(.+) mit ID (.+) wurde nicht gefunden$/.exec(message);
  if (notFound) {
    return `${translateEntity(notFound[1] ?? "")} with ID ${notFound[2]} was not found.`;
  }

  const inUse =
    /^(.+) mit ID (.+) wird noch referenziert und kann nicht gelöscht werden$/.exec(message);
  if (inUse) {
    return `${translateEntity(inUse[1] ?? "")} with ID ${inUse[2]} is still referenced and cannot be deleted.`;
  }

  const backend = /^Speicherfehler: (.+)$/.exec(message);
  if (backend) return `Storage error: ${backend[1]}`;

  const invalidValue = /^Ungültiger Wert: (.+)$/.exec(message);
  if (invalidValue) return `Invalid value: ${invalidValue[1]}`;

  const corrupt = /^Gespeicherte Daten sind unlesbar: (.+)$/.exec(message);
  if (corrupt) return `Stored data is unreadable: ${corrupt[1]}`;

  const invalidDocument = /^Kalkulationsdatei ist ungültig: (.+)$/.exec(message);
  if (invalidDocument) return `Calculation file is invalid: ${invalidDocument[1]}`;

  const unsupportedDocument =
    /^Unbekanntes Kalkulationsformat '(.+)' \(erwartet '(.+)'\)$/.exec(message);
  if (unsupportedDocument) {
    return `Unknown calculation format '${unsupportedDocument[1]}' (expected '${unsupportedDocument[2]}').`;
  }

  const unsupportedVersion =
    /^Kalkulationsdatei hat Version (\d+); unterstützt wird höchstens Version (\d+)$/.exec(
      message,
    );
  if (unsupportedVersion) {
    return `Calculation file has version ${unsupportedVersion[1]}; maximum supported is version ${unsupportedVersion[2]}.`;
  }

  const unreadable = /^Datei '(.+)' konnte nicht (gelesen|geöffnet|geprüft|angelegt|geschrieben) werden: (.+)$/.exec(
    message,
  );
  if (unreadable) {
    const verb = unreadable[2] ?? "gelesen";
    const action =
      {
        gelesen: "read",
        geöffnet: "opened",
        geprüft: "checked",
        angelegt: "created",
        geschrieben: "written",
      }[verb] ?? "read";
    return `File '${unreadable[1]}' could not be ${action}: ${unreadable[3]}`;
  }

  const notAFile = /^'(.+)' ist keine reguläre Datei\.$/.exec(message);
  if (notAFile) return `'${notAFile[1]}' is not a regular file.`;

  const tooLarge = /^Datei '(.+)' ist zu groß \(maximal (\d+) MB für (.+)\)\.$/.exec(message);
  if (tooLarge) return `File '${tooLarge[1]}' is too large (maximum ${tooLarge[2]} MB for ${tooLarge[3]}).`;

  const entryTooLarge =
    /^3MF-Eintrag '(.+)' ist zu groß \(maximal (\d+) Byte\)$/.exec(message);
  if (entryTooLarge) {
    return `3MF entry '${entryTooLarge[1]}' is too large (maximum ${entryTooLarge[2]} bytes).`;
  }

  return message;
}


/** Übersetzt die Entitätsnamen des Speicherports. */
function translateEntity(entity: string): string {
  return (
    {
      Drucker: "Printer",
      Material: "Material",
      "Arbeitsschritt-Kategorie": "Work step category",
      Arbeitsschritt: "Work step",
      Maschinenstundensatz: "Hourly rate",
      Kalkulationsprofil: "Calculation profile",
      Kalkulation: "Calculation",
    }[entity] ?? entity
  );
}
