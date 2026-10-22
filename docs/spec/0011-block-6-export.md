# OpenPrintCost — Spec 0011: Block 6 (Export PDF + Excel)

Status: bereit zur Ausführung — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md` (Abschnitt 7), `docs/spec/0002-block-plan.md`
und Block 1–5.

## Einstufung

**MEDIUM** (kein Formelrisiko — der Export liest nur; Risiko liegt in den
Fremdformaten). Eigenständiger Audit nach der Umsetzung ist Pflicht.

## Ziel

Ein angezeigtes Kalkulationsergebnis lässt sich als **PDF-Report** und als
**Excel-Arbeitsmappe** speichern — über den Dateidialog, mit deutschen
Beträgen und allen Positionen.

Zwei Liefergegenstände:

1. **`opc-export`** — neue Crate mit **puren** Funktionen
   (`CalculationResult` hinein, Bytes heraus): `render_pdf`,
   `render_excel`. Kein IO, kein Clock, kein globaler Zustand. Damit später
   serverseitig wiederverwendbar (Spec 0001, Abschnitt 11.3).
2. **Tauri-Commands + UI-Knöpfe** — `export_result_pdf(result, company)` und
   `export_result_excel(result, company)` rendern, fragen per
   Speichern-Dialog nach dem Pfad und schreiben die Datei. Abbruch des
   Dialogs ist kein Fehler (`null`).

## Nicht in diesem Block

Keine Berechnung im Export (das Ergebnis kommt fertig herein), keine
E-Mail-Anbindung, keine Angebotsvorlagen, keine Firmendaten-Oberfläche
(Block 7 — `CompanyInfo` wird bereits entgegengenommen, aber leer
übergeben).

## Dateien

| Datei | Zweck |
|---|---|
| `crates/opc-export/Cargo.toml` | `opc-export` (`printpdf`, `rust_xlsxwriter`) |
| `crates/opc-export/src/lib.rs` | `CompanyInfo`, `render_pdf`, `render_excel` |
| `crates/opc-export/src/pdf.rs` | PDF-Report (Kopfdaten, Gruppen, Summen) |
| `crates/opc-export/src/excel.rs` | Arbeitsmappe (Positionen, Dateien, Übersicht) |
| `crates/opc-export/src/error.rs` | `ExportError` |
| `crates/opc-export/tests/export.rs` | Inhaltsprüfung: PDF-Magic + Projektname; Excel-Roundtrip via `calamine` |
| `src-tauri/*` | `opc-export`-Dep, 2 Commands, Registrierung |
| `src/api/*` | `CompanyInfo`-Typ, Adapter + Mock, Format bleibt |
| `src/components/CalculationView.tsx` | „PDF exportieren“ / „Excel exportieren“ beim Ergebnis |

## Akzeptanzkriterien

1. `render_pdf`/`render_excel` sind pure (`&CalculationResult` → `Vec<u8>`).
2. PDF beginnt mit `%PDF`, ist nicht leer und enthält den Projektnamen.
3. Excel enthält die Blätter `Positionen`, `Dateien`, `Übersicht`; alle
   Beträge stehen als **Zahlen** (keine Formeln); ein Roundtrip-Test liest
   Positionen und Summen zurück.
4. Deutsche Beträge (Komma) in beiden Formaten.
5. Dialog-Abbruch liefert `null`, kein Fehler.
6. `npm`- und Rust-Gates grün; Tauri-Build im Docker grün.

## Befehle

```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test --locked
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht (Entscheidungen zu Layout, Zahlenformaten,
Firmendaten-Platzhaltern).
