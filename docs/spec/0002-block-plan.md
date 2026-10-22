# OpenPrintCost — Spec 0002: Blockplan

Status: freigegeben (2026-10-21)
Baut auf `docs/spec/0001-mvp-core.md` auf. Jeder Block ist ein eigener OpenCode-Auftrag
mit eigenem Verifikations-Gate.

## Blockübersicht

| Block | Inhalt | Risiko | Gate |
|---|---|---|---|
| **1** | Fundament + `opc-core` Rechenkern (Domänenmodell, Formeln, Maschinenstundensatz) + `LICENSE`/README/CI | hoch (Formeln) | `cargo test` grün, Festwert-Tests, CI-Workflow vorhanden |
| **2** | `opc-store` Persistenz als **Port** + SQLite-Adapter (UUID) + Migrationen + Tauri-Commands | hoch (Speichervertrag) | DB-Tests + `cargo test` |
| **3** | `opc-io` GCode-Parser + STL-Volumen + Datei-Import | hoch (Parser) | Parser-Fixture-Tests |
| **4** | Frontend-Grundgerüst + Stammdatenverwaltung (Drucker/Material/Arbeitsschritte/Stundensatz) | mittel | Vitest + Build |
| **5** | Frontend-Kalkulationsblatt + Ergebnisdarstellung | mittel | Vitest + Playwright |
| **6** | Export PDF + Excel | mittel | Datei-Inhaltsprüfung |
| **7** | Polish: Settings, Profile, Firmendaten, i18n-Vorbereitung | niedrig | Build + manueller Rest |
| **8** | OSS-Paketierung: README, `LICENSE` (Apache-2.0), `CONTRIBUTING.md`, GitHub-Actions-CI (Build + Test), Release-Workflow mit Installationspaketen für Win/macOS/Linux (Spec 0004) | mittel | Reale Release-Artefakte in GitHub Release |

Block 1 und 3 sind die fachlich riskanten Blöcke. Block 1 enthält **keine** UI und
**keine** Datenbank — reine, sofort prüfbare Rechenlogik.

---

## Open-Source- und Erweiterbarkeits-Prinzipien je Block (Basis: Spec 0001 Abschnitt 11)

Ziel: **vollständig funktionsfähige Open-Source-Desktop-App** — ohne Konto, ohne
Lizenzschlüssel, ohne Netzzugriff. Eine spätere kommerzielle Stufe ist möglich,
aber nicht geplant. Die folgenden Regeln haben heute jeweils einen eigenen Nutzen
und kosten fast nichts.

| Block | Prinzip | Nutzen heute |
|---|---|---|
| 1 | UUID v4 als ID, keine SQL-leakenden Typen | Import/Export einer Kalkulation zwischen Installationen ohne ID-Kollision |
| 2 | `opc-store` als **Port** (Domain-API) + SQLite-Adapter | Tests gegen In-Memory-Adapter, kein DB-File nötig |
| 3 | `opc-io` bleibt pure (bytes/strings in, Struktur out) | Parser-Fixtures ohne Dateisystem, deterministische Tests |
| 4 | Frontend kennt Tauri **nur** über `PlatformAdapter` | Browser-E2E ohne Tauri-Binary; UI bleibt gegen die Plattformgrenze testbar |
| 5 | Ergebnisdarstellung liest ausschließlich Engine-Werte | Kein Rechnen in der UI — eine Quelle der Wahrheit |
| 6 | Export-Routinen als pure Rust-Funktionen | Später serverseitig wiederverwendbar, ohne Frontend-Export |
| 7 | Settings/Profile/Firmendaten | Vervollständigt die lokale Nutzung ohne Account-Zwang |

**Bewusst nicht vorbereitet** (kein Nutzen in der OSS-Version, später additiv
ergänzbar): Auth, Mandanten/`account_id`, RLS, Stripe, Feature-Gating,
Lizenzschlüssel, Cloud-Sync, Postgres-Backend.

---

## Block 1 — Fundament + Rechenkern `opc-core`

### Ziel

Rust-Workspace anlegen, `opc-core` als reine Bibliothek (ohne Tauri, ohne DB)
implementieren: Domänenmodell + vollständige Kostenberechnung nach Spec 0001
Abschnitt 4 inklusive Maschinenstundensatz-Berechnung. Jede Formel ist durch einen
Festwert-Test mit von Hand nachgerechneten Sollwerten abgesichert.

### Nicht in diesem Block

Keine Tauri-App, kein SQLite, kein Frontend, kein Parser, kein Export.
`opc-core` ist ausführbar mit `cargo test`, ohne Tauri-Toolchain.

### Dateien

```
/home/monosystems/Projekte/OpenPrintCost/
├── Cargo.toml                                    # Workspace
├── rust-toolchain.toml                           # Pin auf stable
├── crates/opc-core/
│   ├── Cargo.toml
│   ├── src/lib.rs                                # Modul-Exports
│   ├── src/money.rs                              # Decimal-Helfer, Rundung
│   ├── src/units.rs                              # Einheitenfaktor kg/g/lb/oz
│   ├── src/model/mod.rs
│   ├── src/model/printer.rs
│   ├── src/model/material.rs
│   ├── src/model/workstep.rs
│   ├── src/model/hourly_rate.rs
│   ├── src/model/calculation.rs
│   ├── src/model/cost_position.rs                # Ergebnisposition
│   ├── src/calc/mod.rs
│   ├── src/calc/machine_hour_rate.rs
│   ├── src/calc/material.rs
│   ├── src/calc/energy.rs
│   ├── src/calc/worksteps.rs
│   ├── src/calc/margin.rs
│   ├── src/calc/engine.rs                        # Orchestrierung, feste Reihenfolge
│   └── tests/                                    # Integrationstests
```

### Akzeptanzkriterien

1. `cargo test --workspace` läuft ohne Tauri-Toolchain und ist grün.
2. `cargo clippy --workspace --all-targets -- -D warnings` ist warnungsfrei.
3. `cargo fmt --all --check` zeigt keinen Diff.
4. Alle Geldwerte in `opc-core` sind `rust_decimal::Decimal`. Kein `f64` für Geld.
   `f64` nur für physikalische Messwerte, mit expliziter Konvertierung an der Grenze.
5. Die Reihenfolge der Kostenblöcke entspricht Spec 0001 Abschnitt 4.4–4.9 exakt.
6. Fehlerrate, Marge und Steuer erscheinen als **eigene** Positionen in der
   Ergebnisliste, nicht eingerechnet.
7. Die Engine ist **pure**: `fn calculate(input: &CalculationInput) -> CalculationResult`.
   Kein Dateisystem, kein Netzwerk, kein globales State, kein Clock.
   Zeitstempel werden dem Aufrufer übergeben, nicht intern gelesen.
8. Jede öffentliche Funktion hat einen Doc-Comment, der die Formel nennt.
9. Serialisierung: `CalculationResult` serialisiert mit `serde`; `Decimal` wird als
   **String** serialisiert (`serde_with` oder eigener `serde`-Modul), nie als `f64`.

### Festwert-Tests (Sollwerte, von Hand nachgerechnet)

**Materialkosten**
```
volumen_cm3 = 10, dichte = 1.24 g/cm³, stückzahl = 1
gewicht_g              = 12.40
material_g             = 12.40
material: 1 kg (1000 g) für 25.00 €  →  preis_pro_gramm = 0.025
materialkosten         = 0.31 €            (0.31000 exakt)
```

**Energiekosten**
```
druckzeit = 2 h, leistung = 100 W, leistungsgrad = 100 %, energiepreis = 0.35 €/kWh
verbrauch_kwh           = 0.2
energiekosten           = 0.07 €            (0.070 exakt)
```

**Maschinenkosten**
```
stundensatz = 25 €/h, druckzeit = 2 h  →  maschinenkosten = 50.00 €
```

**Fehlerrate 10 %**
```
druckzeit_fehler        = 0.2 h
material_g_fehler       = 1.24 g
materialkosten_fehler   = 0.031 €           (1.24 × 0.025)
```

**Maschinenstundensatz-Berechnung**
```
wiederbeschaffung = 1000 €, nutzungsdauer = 4 a, zinssatz = 3 %
maschinenstunden = 800 (pro Jahr)
fix: wartung 50, miete 20, strom 30, zusatz 10
var: wartung 5, strom 10, zusatz 0
abschreibung       = 250
zins               = 15
stundensatz        = (250 + 15 + (110)×1 + (15)×1) / (800×1) = 0.4875 €/h
```

**Marge + Steuer (auf Basis der obigen Minimal-Fixture: Material 0.31 + Maschine 50 + Energie 0.07)**
```
basis              = 50.38
marge 20 %         = 10.076
steuer 19 %        = 11.48664   (auf basis + marge)
gesamt             = 71.94264   (Anzeige gerundet 71.94)
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

### Erzwungene Randfälle (Negativtests)

- `stückzahl = 0` → keine Material-/Maschinenpositionen, keine Division-By-Zero.
- `maschinenstunden = 0` → Stundensatz 0, Maschinenkosten 0.
- `nutzungsdauer = 0` → Abschreibung 0.
- `druckzeit = 0` → Energiekosten 0.
- `dichte = 0` → Gewicht 0, Materialkosten 0.
- `fehlerrate = 0` → keine FailRate-Positionen.
- `steuersatz = 0` → keine Steuerposition.
- `marge = 0` → keine Margeposition.
- `verpackungsgröße = 0` → Division-By-Zero muss als `Err` kommen, **nicht** als
  Panic und **nicht** als `0.0`. Rückgabetyp der Engine ist `Result`.

### Befehle (in `/home/monosystems/Projekte/OpenPrintCost`)

```bash
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

Erwartung: `cargo test` grün mit allen Festwert-Tests bestanden, keine
`ignored`-Tests, keine `#[allow]`, keine Warnungen.

### Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht, weil in Block 1 fachliche Detailentscheidungen
(getroffene Formelinterpretationen) zu dokumentieren sind.
