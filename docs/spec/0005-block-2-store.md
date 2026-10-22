# OpenPrintCost — Spec 0005: Block 2 (Persistenz `opc-store` + Tauri-Commands)

Status: bereit zur Ausführung — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md` (fachlicher Vertrag),
`docs/spec/0002-block-plan.md` (Blockübersicht) und `docs/spec/0003-block-1-core.md`
(Block 1 — abgeschlossen).

## Einstufung

**LARGE** (neue Persistenzschicht, Vertragsbruch-Risiko). Eigenständiger
Audit nach der Umsetzung ist Pflicht.

## Ziel

Die Stammdaten und Kalkulationen **lokal und dauerhaft speicherbar** machen —
ohne dass die Fachlogik (`opc-core`) oder die Oberfläche etwas vom
Speicherbackend wissen.

Zwei Liefergegenstände:

1. **`opc-store`** — eine neue Crate mit dem **Port** (Domänen-API ohne
   SQL-Leak) und einem **SQLite-Adapter**, Migrationen und einem
   In-Memory-Adapter als Testdouble.
2. **`src-tauri`** — die Tauri-App-Hülle mit den **Commands**, die den Port
   verwenden. Die Commands kennen ausschließlich den Port, nie SQLite.

## Nicht in diesem Block

Kein Frontend-Fachlogik (Block 4), keine GCode-/STL-Parser (Block 3), kein
PDF-/Excel-Export (Block 6), keine Cloud-Sync, keine Mandanten, kein Auth.

## Dateien

| Datei | Zweck |
|---|---|
| `crates/opc-store/Cargo.toml` | Paketmanifest (`opc-store`) |
| `crates/opc-store/src/lib.rs` | Crate-Doku, Modul-Exports, Store-Builder |
| `crates/opc-store/src/error.rs` | `StoreError` (thiserror) |
| `crates/opc-store/src/port.rs` | Der **Port**: Repository-Traits + `Store`-Kompositum |
| `crates/opc-store/src/record.rs` | Persistenz-DTOs (`StoredCalculation`, `CalculationSummary`) |
| `crates/opc-store/src/memory.rs` | In-Memory-Adapter (Implementierung des Ports) |
| `crates/opc-store/src/sqlite/mod.rs` | SQLite-Adapter |
| `crates/opc-store/src/sqlite/migrations.rs` | Eingebettete, versionierte Migrationen |
| `crates/opc-store/src/sqlite/mapping.rs` | Zeile ↔ Domänenobjekt |
| `crates/opc-store/tests/store.rs` | Integrationstests, **identische Suite für beide Adapter** |
| `src-tauri/Cargo.toml` | Tauri-Binärpaket |
| `src-tauri/build.rs` | `tauri-build` |
| `src-tauri/tauri.conf.json` | Tauri-Konfiguration |
| `src-tauri/src/main.rs` | Desktop-Entry (Fenster) |
| `src-tauri/src/lib.rs` | App-Bau, State-Setup, Command-Registrierung |
| `src-tauri/src/commands.rs` | Tauri-Commands über den Port |
| `src-tauri/src/error.rs` | Fehlerübersetzung Command → Tauri-Fehler |
| `src-tauri/icons/` | App-Icons (PNG, 32/128/256) |
| `Cargo.toml` | Workspace: `crates/opc-store` + `src-tauri` als Member |

## Akzeptanzkriterien

1. `opc-core` bleibt unverändert und **ohne** `opc-store`-Abhängigkeit. Der
   Rechenkern kennt weder IO noch das Datenmodell.
2. `opc-store` hat **keine** Tauri-Abhängigkeit. Der Port ist ohne Tauri
   testbar.
3. Der Port enthält **keinen SQL-Leak**: keine Row-Typen, keine Query-Bausteine,
   keine Spaltennamen im Trait. Rückgabewerte sind Domänenobjekte aus
   `opc-core` bzw. `record.rs`.
4. **Dieselbe Testsuite** läuft gegen den SQLite-Adapter **und** den
   In-Memory-Adapter (`tests/store.rs`, generisch über `&dyn Store`). Dadurch
   ist die Austauschbarkeit des Backends bewiesen, nicht behauptet.
5. IDs sind **UUID v4**, in SQLite als `TEXT` (36 Zeichen, kanonisch
   kleingeschrieben). Kein `INTEGER PRIMARY KEY`, kein `AUTOINCREMENT`.
6. **Geldbeträge und Messwerte werden als `TEXT` gespeichert**, nicht als
   `REAL`. SQLite kennt keinen exakten Dezimaltyp; `REAL` würde die in
   `opc-core` garantierte Exaktheit zerstören. Beim Lesen wird der String
   zurück in `Decimal` geparst.
7. Migrationen sind **eingebettet** (`include_str!`), versioniert und werden in
   aufsteigender Version genau einmal angewandt. Angewandte Migrationen werden
   **nie** geändert. `schema_migrations` protokolliert die Versionen.
8. Ein Öffnen einer Datenbank mit **unbekannter künftiger Version** bricht
   mit einem klaren Fehler ab, statt stillschweigend weiterzulaufen.
9. Der Adapter ist `Send + Sync` (SQLite-Verbindung hinter einem `Mutex`),
   damit Tauri ihn als State halten kann.
10. Löschen eines nicht existierenden Eintrags liefert `Err(StoreError::NotFound)`,
    kein stilles Erfolgs-Ergebnis.
11. Eine Kalkulation wird als **Schnappschuss** gespeichert: das vollständige
    `CalculationInput`-Dokument als JSON in `calculations.document`. Änderungen
    an den Stammdaten verändern gespeicherte Kalkulationen **nicht**.
12. Die Tauri-Commands nutzen ausschließlich `Arc<dyn Store>`. Es gibt in
    `src-tauri/` **kein** direktes SQLite.
13. `cargo test --workspace` ist grün, `cargo clippy --workspace --all-targets
    -- -D warnings` ist warnungsfrei, `cargo fmt --all --check` zeigt keinen
    Diff.
14. Auf einer Maschine mit den Tauri-Systembibliotheken baut
    `cargo build -p openprintcost` (Debug) die Desktop-App inklusive aller
    Commands. Der Release-Bundle gehört zu Block 8.
15. `npm run build` erzeugt `dist/` — der Tauri-Bundle braucht es als
    `frontendDist`.

## Datenmodell (Migration 1)

```sql
schema_migrations(version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)

printers               (id, model, manufacturer, process, material_family,
                        power_watts, build_volume_mm3, purchase_price,
                        hourly_rate, nozzle_wear_cost, build_plate_wear_cost,
                        material_change_cost, properties, created_at, updated_at)

materials              (id, name, material_type, family, manufacturer, shop_link,
                        density_g_cm3, package_size, unit, price, properties,
                        created_at, updated_at)

workstep_categories    (id, name, color)
worksteps              (id, name, category_id, calculation_type, price, quantity,
                        duration_hours, timing, created_at, updated_at)

hourly_rates           (id, name, time_basis, machine_hours, replacement_cost,
                        service_life_years, interest_rate_percent,
                        maintenance_fixed, rent_fixed, electricity_fixed,
                        additional_fixed, maintenance_variable,
                        electricity_variable, additional_variable,
                        fixed_rate_override, created_at, updated_at)

calculation_profiles   (id, name, fail_rate_percent, tax_rate_percent,
                        margin_percent, handling_fee, handling_fee_scope,
                        energy_price_per_kwh, apply_energy_costs,
                        power_level_percent, combine_materials,
                        multiply_print_time_with_quantity, print_time_factor,
                        exclude_machine_from_margin, exclude_material_from_margin,
                        exclude_worksteps_from_margin, created_at, updated_at)

calculations           (id, project_name, notes, created_at, updated_at, document)
calculation_files      (id, calculation_id, file_name, quantity, print_time_hours,
                        volume_cm3, weight_g, material_changes, sort_order)
```

`properties` (die freien Eigenschaften der Stammdaten) wird als JSON-Text in
einer Spalte abgelegt — sie sind ein offenes Feld, keine eigene Entität.

## Tauri-Commands

Alle IDs werden als `String` über die Grenze transportiert (UUID-Text) und im
Command in `Uuid` geparst; ungültige UUIDs ergeben einen Fehler, keine Panic.

| Command | Zweck |
|---|---|
| `list_printers` / `get_printer` / `save_printer` / `delete_printer` | Drucker |
| `list_materials` / `get_material` / `save_material` / `delete_material` | Material |
| `list_workstep_categories` / `save_workstep_category` / `delete_workstep_category` | Kategorien |
| `list_worksteps` / `get_workstep` / `save_workstep` / `delete_workstep` | Arbeitsschritte |
| `list_hourly_rates` / `get_hourly_rate` / `save_hourly_rate` / `delete_hourly_rate` | Stundensätze |
| `list_calculation_profiles` / `get_calculation_profile` / `save_calculation_profile` / `delete_calculation_profile` | Profile |
| `list_calculations` / `get_calculation` / `save_calculation` / `delete_calculation` | Kalkulationen |
| `calculate` | Rechnet eine Kalkulation durch (`opc-core`, ohne DB) |
| `database_path` | Pfad der verwendeten SQLite-Datei |

`calculate` ruft `opc_core::calculate` direkt — die Berechnung braucht keinen
Datenbankzugriff.

## Grenzen dieser Crate

* **Keine Mandanten, kein Konto, kein Login.** Die Datei gehört dem
  Benutzerverzeichnis der App.
* **Kein Cloud-Sync, keine Netzwerkzugriffe.**
* **Kein Schema-Export.** Ein späterer Import/Export (Spec-0001-Abschnitt 11.1)
  nutzt die UUIDs, nicht die Datenbank.

## Befehle

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht (Block 2 trifft Entscheidungen zu Zeitstempeln,
Löschen-Semantik und zur Grenze zwischen Port und Adapter).
