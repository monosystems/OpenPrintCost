# OpenPrintCost — Spec 0012: Block 7 (Polish: Profile, Firma, Settings, i18n)

Status: bereit zur Ausführung — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md`, `docs/spec/0002-block-plan.md` und
Block 1–6.

## Einstufung

**SMALL** (kein Formelrisiko, keine neuen Formate; Fleißarbeit mit klaren
Mustern). Eigenständiger Audit nach der Umsetzung ist Pflicht.

## Ziel

Die App ist **rund**: benannte Kalkulationsprofile sind verwaltbar,
Firmendaten stehen persistent und fließen in den Exportkopf, eine
Einstellungsansicht bündelt Umgebung + Über, und alle Oberflächentexte
liegen in **einem** Wörterbuch (`src/i18n/de.ts`) — eine zweite Sprache ist
damit additiv möglich.

Vier Liefergegenstände:

1. **Profile-Verwaltung** — CRUD-Oberfläche für `CalculationProfile` über
   die fertigen Commands (Muster wie Block 4).
2. **Firmendaten** — persistiert: Migration 2 (`company_info`, Singleton),
   `CompanyRepository`-Port, SQLite- + Memory-Implementierung, Commands,
   Formular. Der Export nutzt sie (statt leerer `CompanyInfo`).
3. **Einstellungen** — Firmendaten-Formular, Datenbankpfad, App-Info
   (Version, Lizenz, Tech-Stack); neuer Tab.
4. **i18n-Grundlage** — `src/i18n/de.ts` als einzige Quelle deutscher Texte;
   alle Komponenten nutzen sie. Kein Sprachumschalter (nur Vorbereitung).

## Nicht in diesem Block

Keine Berechnung im Export (bleibt), keine englische Übersetzung (nur das
Wörterbuch-Format + ein Strukturtest), kein Theme-Wechsler, keine
Tastaturkürzel.

## Dateien

| Datei | Zweck |
|---|---|
| `crates/opc-store/src/sqlite/migrations/0002_company_info.sql` | Migration 2 |
| `crates/opc-store/src/{port,record,sqlite,memory}.rs` | `CompanyRepository` + `CompanyInfo` |
| `crates/opc-store/tests/store.rs` | Roundtrip + Default-Tests |
| `src-tauri/src/commands.rs` | `get_company_info`/`save_company_info` (record-Typ direkt) |
| `src/api/*` | Adapter + Mock |
| `src/components/ProfilesView.tsx` | Profil-CRUD (17 Felder, gruppiert) |
| `src/components/SettingsView.tsx` | Firma + Umgebung + Über |
| `src/components/CalculationView.tsx` | Export nutzt gespeicherte Firma |
| `src/i18n/de.ts` | Wörterbuch; alle Views migriert |
| `src/App.tsx` | Tabs „Profile“, „Einstellungen“ |

## Akzeptanzkriterien

1. Migration 2 läuft auf frischer und bestehender DB (Store-Tests).
2. Firma speichern → Exportkopf enthält sie (Test: Roundtrip über Adapter).
3. Profil-CRUD funktioniert (Vitest); 17 Felder, gültige und ungültige
   Eingaben wie in Block 4 validiert.
4. Kein deutscher Stringliteral außerhalb `de.ts` + Tests (per Grep belegbar;
   Tests dürfen Texte zum Finden nutzen, definieren aber keine).
5. Strukturtest: jeder Wörterbuch-Eintrag ist ein nicht-leerer String.
6. Alle Gates grün (npm + Rust + Docker).

## Befehle

```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test --locked
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht.
