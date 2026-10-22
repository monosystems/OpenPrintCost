# OpenPrintCost

**Kostenkalkulation für 3D-Druck-Aufträge — frei, lokal, quelloffen.**

OpenPrintCost berechnet, was ein 3D-Druck-Auftrag wirklich kostet: Material,
Maschinenzeit, Energie, Arbeitsschritte, Verbrauchsmittel, Marge und Steuer —
nachvollziehbar aufgeschlüsselt und als PDF/Excel exportierbar.

Die fachliche Ausrichtung folgt dem 3D-Druckkosten-Kalkulator von
Andreas Reitberger (ar3dp.de). Die Implementierung ist eine **eigenständige
Eigenentwicklung** unter Apache-2.0-Lizenz; es wurde kein GPL-Code übernommen.
Die Formelsemantik richtet sich an der Apache-2.0-Bibliothek
[`3dPrintCostCalculatorSharp`](https://github.com/AndreasReitberger/3dPrintCostCalculatorSharp).

## Warum OpenPrintCost?

* **Lokal und ohne Konto.** Keine Anmeldung, kein Lizenzschlüssel, kein
  Netzzugriff. Alle Daten bleiben auf dem eigenen Rechner.
* **Exakte Beträge.** Alle Geldbeträge werden als `Decimal` gerechnet — kein
  `f64`, keine Rundungsfehler in der Kostenkette. Gerundet wird erst bei der
  Anzeige.
* **Nachvollziehbar.** Jeder Kostenblock ist eine eigene Position. Marge und
  Steuer werden nie im Basispreis versteckt, die Fehlerrate nie als pauschaler
  Aufschlag verrechnet.
* **Offen entwickelt.** Der gesamte Quellcode — inklusive Build- und
  Release-Pipeline — liegt im Repository.

## Status

Dieses Repository enthält den **Rechenkern** (`opc-core`): die vollständige,
sofort testbare Kostenberechnung als reine Rust-Bibliothek.

| Bereich | Status |
|---|---|
| Rechenkern `opc-core` | ✅ fertig, 39 Tests + 7 Doc-Tests |
| Persistenz (SQLite) | ⏳ geplant |
| GCode-/STL-Parser | ⏳ geplant |
| Desktop-Oberfläche (Tauri) | ⏳ geplant |
| PDF-/Excel-Export | ⏳ geplant |

Die vollständige Spezifikation liegt in [`docs/spec/`](docs/spec/).

## Funktionsumfang des Rechenkerns

* **Drucker** — Modell, Verfahren (FDM/SLA/Pulverbett), Bemessungsleistung,
  Bauvolumen, Kaufpreis, optionaler Maschinenstundensatz, Verschleißkosten für
  Düse und Druckplatte, Kosten für Materialwechsel.
* **Material** — Bezeichnung, Typ (PLA, PETG, …), Dichte, Verpackungsgröße
  mit Einheit (kg/g/lb/oz), Preis; daraus wird der Preis pro Gramm abgeleitet.
* **Arbeitsschritte** — pro Stunde, pro Stück oder pro Auftrag, kategorisiert
  und zeitlich zugeordnet (vor/nach/sonstiges).
* **Maschinenstundensatz** — aus Abschreibung, Zins, Fix- und Variablenkosten
  über eine Jahres- oder Monatsbasis; ein frei gesetzter Stundensatz
  überschreibt die Berechnung.
* **Kalkulationsprofil** — Fehlerrate, Steuersatz, Gewinnmarge,
  Handlungspauschale, Energiepreis, Leistungsgrad sowie Schalter zum
  Ausschluss einzelner Kostenblöcke von der Margenberechnung.
* **Kostenblöcke** — Material, Maschine, Energie, verfahrensspezifische
  Zuschläge, Arbeitsschritte, Zusatzartikel, Handlungspauschale, prozentuale
  Zuschläge (vor und nach der Marge), Marge, Steuer.
* **Fehlerrate** — erzeugt eigene Positionen für Druckzeit, Material, Maschine
  und Energie; der verworfene Druck ist bezahlt und fließt in die Gesamtkosten
  ein.

## Architektur

```text
crates/opc-core/          Rechenkern — pure, ohne IO, ohne Tauri, ohne DB
  src/money.rs            Decimal-Helfer, kaufmännische Rundung
  src/units.rs            Einheitenfaktoren kg/g/lb/oz
  src/model/              Domänenmodell (Drucker, Material, …)
  src/calc/               Kostenformeln + Orchestrierung
  tests/calculation.rs    Integrationstests mit von Hand nachgerechneten Sollwerten
```

Drei Invarianten prägen den Aufbau:

1. **`opc-core` ist pure.** Kein Dateisystem, kein Netzwerk, kein globaler
   Zustand, keine Uhr. Jede Formel ist ohne Nebenwirkungen testbar.
2. **IDs sind UUID v4.** Damit sind Kalkulationen zwischen Installationen
   exportierbar und importierbar, ohne dass IDs kollidieren.
3. **Geld ist ausschließlich `Decimal`.** Serialisiert wird als String, damit
   Exporte diff-freundlich und verlustfrei bleiben.

Der Kern kompiliert nach `wasm32-unknown-unknown` — eine spätere
Browser-Variante wäre damit ohne zweites Rechenmodell möglich.

## Entwicklung

Voraussetzung: eine aktuelle Rust-Toolchain (stable). Kein Tauri- und kein
Node-Toolchain nötig, um den Rechenkern zu bauen oder zu testen.

```bash
cargo build                       # Rechenkern bauen
cargo test --workspace            # alle Tests (39 + 7 Doc-Tests)
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all --check
```

Die Dateien `src/` und `src-tauri/` gehören zur späteren Desktop-Oberfläche
und sind noch leer.

## Lizenz

[Apache-2.0](LICENSE) — mit ausdrücklichem Patentschutz und uneingeschränkter
kommerzieller Nutzbarkeit.

**Hinweis zu den Formeln:** Die Formelsemantik orientiert sich an der
Apache-2.0-Bibliothek `3dPrintCostCalculatorSharp` von Andreas Reitberger. Es
handelt sich um eine eigenständige Implementierung; der GPL-lizenzierte
Quellcode der Desktop-Anwendung wurde nicht übernommen. Bekannte Fehler der
Referenz (insbesondere die doppelte Materialberechnung bei Multi-Material-
Dateien) wurden **nicht** nachgebildet.
