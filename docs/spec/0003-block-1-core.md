# OpenPrintCost — Spec 0003: Block 1 (Fundament + Rechenkern)

Status: bereit zur Ausführung — 2026-10-21
Aufbauend auf `docs/spec/0001-mvp-core.md` (fachlicher Vertrag) und
`docs/spec/0002-block-plan.md` (Blockübersicht).

## Einstufung

**LARGE** (neue Architektur, sicherheitskritische Geldsemantik). Eigenständiger
Hermes-Audit nach der Umsetzung ist Pflicht.

## Voraussetzungen (vor Dispatch)

- [x] Rust-Toolchain vorhanden: `cargo 1.99.1`, `rustc 1.99.1`, `rustup 1.29.2`,
      Toolchain `stable-x86_64-unknown-linux-gnu`. **Achtung:** `cargo` liegt in
      `~/.cargo/bin` und ist **nicht** im Standard-PATH. Jeder Shell-Befehl braucht
      `export PATH="$HOME/.cargo/bin:$PATH"`.
- [x] crates.io erreichbar (verifiziert: `cargo add` + `cargo test` + `cargo run`
      erfolgreich mit `rust_decimal`, `serde`, `serde_json`, `thiserror`).
- [x] `rust_decimal::Decimal` ↔ String-Serialisierung verifiziert
      (Ausgabe `{"v":"12.34"}`).
- [ ] Branch `feat/mvp-core` existiert (Hermes legt ihn an, inkl. Spec-Commit).

**Verifizierte Stolperfallen** (aus dem Toolchain-Smoke-Test, bitte beachten):

1. `serde` braucht zwingend das Feature `derive` — sonst existiert das
   `#[derive(Serialize)]`-Makro nicht. Manifest: `serde = { version = "1", features = ["derive"] }`.
2. `rust_decimal` braucht für die String-Serialisierung das Feature `serde-with-str`:
   `rust_decimal = { version = "1.43.0", features = ["serde-with-str"] }`.
   Dann funktioniert `#[serde(with = "rust_decimal::serde::str")]`.
3. `cargo new` legt `edition = "2024"` an — verfügbar und funktionsfähig.
4. `cargo clippy --workspace --all-targets -- -D warnings` braucht `clippy` und
   `rustfmt` — beide sind in `~/.cargo/bin` vorhanden.

## Ziel

Rust-Workspace mit einer reinen, sofort testbaren Bibliothek `opc-core`, die die
gesamte Kostenberechnung nach Spec 0001 Abschnitt 4 abbildet. Die Bibliothek hat
**keine** Tauri-, keine Datenbank- und keine Dateisystemabhängigkeit; jedes
Formelverhalten ist durch einen Test mit von Hand nachgerechneten Sollwert belegt.

## Nicht in diesem Block

Keine Tauri-App, kein `tauri.conf.json`, kein SQLite, kein Frontend, kein GCode-/
STL-Parser, kein PDF/Excel-Export, kein `opc-store`, kein `opc-io`.

## Dateien (genau diese, keine weiteren)

| Datei | Zweck |
|---|---|
| `Cargo.toml` | Workspace mit Member `crates/opc-core` |
| `rust-toolchain.toml` | Pin auf `stable` + `rustfmt` + `clippy` |
| `.gitignore` | `target/`, `*.db`, Editor-Artefakte |
| `crates/opc-core/Cargo.toml` | Paketmanifest mit den verifizierten Features |
| `crates/opc-core/src/lib.rs` | Modul-Exports, Crate-Doku |
| `crates/opc-core/src/money.rs` | `Decimal`-Helfer, kaufmännische Rundung, EUR-Konstanten |
| `crates/opc-core/src/units.rs` | Einheitenfaktor kg/g/lb/oz, Materialeinheit-Enum |
| `crates/opc-core/src/model/mod.rs` | Modul-Deklarationen, gemeinsame Typen |
| `crates/opc-core/src/model/printer.rs` | `Printer` (Drucker) |
| `crates/opc-core/src/model/material.rs` | `Material` |
| `crates/opc-core/src/model/workstep.rs` | `Workstep`, `WorkstepCategory`, `WorkstepCalculationType` |
| `crates/opc-core/src/model/hourly_rate.rs` | `HourlyRate` (Maschinenstundensatz) |
| `crates/opc-core/src/model/calculation.rs` | `CalculationInput`, `CalculationFileInput` |
| `crates/opc-core/src/model/cost_position.rs` | `CostPosition` (Ergebnisposition), `CostGroup` |
| `crates/opc-core/src/calc/mod.rs` | Modul-Deklarationen |
| `crates/opc-core/src/calc/machine_hour_rate.rs` | Stundensatz-Berechnung (Spec 4.6) |
| `crates/opc-core/src/calc/material.rs` | Materialkosten (Spec 4.2) |
| `crates/opc-core/src/calc/energy.rs` | Energiekosten (Spec 4.4) |
| `crates/opc-core/src/calc/worksteps.rs` | Arbeitsschritte (Spec 4.5) |
| `crates/opc-core/src/calc/margin.rs` | Marge, Steuer, Custom-Zuschläge (Spec 4.9) |
| `crates/opc-core/src/calc/engine.rs` | `calculate()` — Orchestrierung in fester Reihenfolge |
| `crates/opc-core/tests/calculation.rs` | Integrationstests mit den Festwerten |

## Akzeptanzkriterien

1. `cargo test --workspace` ist grün **ohne** Tauri-Toolchain und ohne Netzwerk
   zur Laufzeit.
2. `cargo clippy --workspace --all-targets -- -D warnings` ist warnungsfrei.
3. `cargo fmt --all --check` zeigt keinen Diff.
4. Alle Geldbeträge sind `rust_decimal::Decimal`. **Kein** `f64` für Geld.
   `f64` ist ausschließlich für physikalische Messwerte erlaubt (Druckzeit h,
   Volumen cm³, Leistung W) und wird an der Grenze in `Decimal` konvertiert.
5. `Decimal` wird per `serde` als **String** serialisiert, nie als `f64`.
   `CalculationInput` und `CalculationResult` sind serialisierbar und
   round-trip-fähig (String → Decimal → String stabil).
6. Die Kostenreihenfolge entspricht Spec 0001 Abschnitt 4.4–4.9 exakt.
   Der Reihenfolge-Code ist als Kommentar im `engine.rs` dokumentiert.
7. Fehlerrate, Marge und Steuer erscheinen als **eigene** `CostPosition` in der
   Ergebnisliste. Keine Einrechnung in den Basispreis.
8. `calculate()` ist pure: keine IO, kein Netzwerk, kein globales State, kein
   `SystemTime::now()`-Aufruf. Zeitstempel kommen als Parameter hinein.
9. Jede öffentliche Funktion trägt einen Doc-Comment mit der zugehörigen Formel
   (Verweis auf Spec-Abschnitt).
10. Rückgabetyp der Engine ist `Result<CalculationResult, CalcError>`.
    `CalcError` ist ein `thiserror`-Enum mit mindestens den Varianten
    `DivisionByZero` (Feldname im Fehler), `InvalidInput`, `Arithmetic`.
11. Keine `#[ignore]`, keine `todo!()`, kein `unimplemented!()`, keine
    `unwrap()`/`expect()` in Produktionspfaden (Panics sind in `Result` zu wandeln).
12. **SaaS-Nahtstelle (Spec 0001 Abschnitt 11):** jede Entität (`Printer`,
    `Material`, `Workstep`, `HourlyRate`, `CalculationInput`-Dateien) trägt
    `id: Uuid` (UUID v4) und `account_id: Uuid`. `CalculationResult`-Positionen
    referenzieren die Entitäts-UUID. Kein `INTEGER`-Primärschlüssel.
    `Uuid`-Dependency mit `features = ["v4", "serde"]`.

## Festwert-Tests (Sollwerte — verbindlich)

**Materialkosten**
```
volumen_cm3 = 10, dichte = 1.24 g/cm³, stückzahl = 1
gewicht_g              = 12.40
material_g             = 12.40
material: 1 kg (1000 g) für 25.00 €  →  preis_pro_gramm = 0.025
materialkosten         = 0.31 €            (exakt 0.31000)
```

**Energiekosten**
```
druckzeit = 2 h, leistung = 100 W, leistungsgrad = 100 %, energiepreis = 0.35 €/kWh
verbrauch_kwh           = 0.2
energiekosten           = 0.07 €            (exakt 0.070)
```

**Maschinenkosten**
```
stundensatz = 25 €/h, druckzeit = 2 h  →  maschinenkosten = 50.00 €
```

**Fehlerrate 10 %**
```
druckzeit_fehler        = 0.2 h
material_g_fehler       = 1.24 g
materialkosten_fehler   = 0.031 €          (1.24 × 0.025)
```

**Maschinenstundensatz-Berechnung**
```
wiederbeschaffung = 1000 €, nutzungsdauer = 4 a, zinssatz = 3 %
maschinenstunden = 800 (pro Jahr)
fix: wartung 50, miete 20, strom 30, zusatz 10
var: wartung 5, strom 10, zusatz 0
abschreibung       = 250
zins               = 15
stundensatz        = (250 + 15 + 110×1 + 15×1) / (800×1) = 0.4875 €/h
```

**Marge + Steuer** (Basis: Material 0.31 + Maschine 50 + Energie 0.07)
```
basis              = 50.38
marge 20 %         = 10.076
steuer 19 %        = 11.48664          (auf basis + marge)
gesamt             = 71.94264         (Anzeige gerundet 71.94)
```

**Handlungspauschale**
```
je Datei: 5.00 € × stückzahl 3 = 15.00 €, Position je Datei
einmal:   5.00 €, genau eine Position auf Projektebene
```

**Arbeitsschritte**
```
pro Stück:  0.50 € × menge 1 × stückzahl 3 = 1.50 €
pro Stunde: 40.00 €/h × dauer 0.25 h       = 10.00 €
pro Auftrag: 7.50 € × menge 1               = 7.50 € (einmal)
```

**Erzwungene Randfälle (Negativtests)**
- `stückzahl = 0` → keine Material-/Maschinenpositionen, keine Division-By-Zero.
- `maschinenstunden = 0` → Stundensatz 0, Maschinenkosten 0.
- `nutzungsdauer = 0` → Abschreibung 0.
- `druckzeit = 0` → Energiekosten 0.
- `dichte = 0` → Gewicht 0, Materialkosten 0.
- `fehlerrate = 0` → keine FailRate-Positionen.
- `steuersatz = 0` → keine Steuerposition.
- `marge = 0` → keine Margeposition.
- `verpackungsgröße = 0` → `Err(CalcError::DivisionByZero)`, **nicht** Panic,
  **nicht** `0.0`.

## Befehle (in `/home/monosystems/Projekte/OpenPrintCost`)

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Erwartung: alle drei Exit-Code 0, `cargo test` mit allen Festwert-Tests bestanden,
keine `ignored`-Tests, keine Warnungen.

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist **Pflicht** (Block 1 trifft fachliche Detailentscheidungen,
z. B. Rundungszeitpunkt und Interpretation von Fehlerrate bei mehreren Dateien).
