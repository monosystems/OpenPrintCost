# OpenPrintCost — Spec 0009: Block 5 (Kalkulationsblatt + Ergebnis)

Status: bereit zur Ausführung — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md` (Abschnitte 4–6), `docs/spec/0002-block-plan.md`
und Block 1–4.

## Einstufung

**MEDIUM** (kein Formelrisiko — die Engine steht; Risiko liegt in der
Zustandsführung des Blatts und der Import-Verdrahtung). Eigenständiger Audit
nach der Umsetzung ist Pflicht.

## Ziel

Eine Kalkulation ist **anlegbar, durchrechenbar, einsehbar, speicherbar und
wieder ladbar** — über die Oberfläche, ohne dass eine Komponente Tauri direkt
kennt:

* Kopfdaten: Projektname, Notizen, Drucker, Stundensatz (optional), Profil
  (inline editierbar — die *Verwaltung* benannter Profile gehört zu Block 7).
* Dateien: manuelle Mengengerüste **oder** GCode-/STL-Import
  (`parse_gcode`/`parse_stl` via neue Commands; Backend liest die Datei vom
  Pfad, damit Binärdateien nicht durch JSON müssen).
* Auswahl: Materialien je Datei, Arbeitsschritte, Zusatzartikel
  (projektweit oder je Datei), prozentuale Zuschläge (vor/nach Marge),
  Handlungspauschale.
* Ergebnis: Positionen gruppiert nach Kostengruppe mit Datei-Zuordnung,
  Fehlerrate-Kennzeichnung, Summen (Basis/Marge/Steuer/Gesamt), deutsche
  Formatierung. Speichern als Schnappschuss; Liste gespeicherter
  Kalkulationen mit Laden und Löschen.

## Nicht in diesem Block

Kein PDF-/Excel-Export (Block 6), keine Profil-/Firmendaten-Verwaltung
(Block 7), kein Router, kein Drag-&-Drop von Dateien (Dateidialog genügt),
kein Playwright-E2E (kein Browser in dieser Umgebung — Vitest +
Komponententests tragen das Gate; dokumentierte Abweichung vom Blockplan).

## Neue Commands (`src-tauri`)

| Command | Zweck |
|---|---|
| `import_gcode_file(path)` | Liest eine GCode-Datei vom Pfad, liefert `GcodeInfo` |
| `import_stl_file(path)` | Liest eine STL-Datei vom Pfad, liefert `StlInfo` |

Das Backend liest die Datei (kein Binärtransport durch JSON). Die
Dateiauswahl läuft über `@tauri-apps/plugin-dialog` (`open`) — im Adapter
gekapselt (`pickImportFile`), Mock liefert `null` und belegt Importe mit
Demo-Daten. `dialog:default`-Berechtigung in `capabilities/default.json`
ergänzen.

## Dateien

| Datei | Zweck |
|---|---|
| `src/api/types.ts` | + Kalkulations-, Positions-, Ergebnis-, Import-Typen |
| `src/api/platform.ts` | + `calculate`, Kalkulationen-CRUD, Importe, Dateidialog |
| `src/api/tauriAdapter.ts` | + neue Commands, `open`-Dialog |
| `src/api/mockAdapter.ts` | + Demo-Implementierungen (Demo-`GcodeInfo`/`StlInfo`, Echo-`calculate`) |
| `src/components/CalculationView.tsx` | Blatt: Kopf, Dateien, Auswahl, Aktionen |
| `src/components/CalculationResultView.tsx` | Ergebnis: Gruppen, Positionen, Summen |
| `src/App.tsx` | + Tab „Kalkulation“ |
| `src/api/calculationAdapter.test.ts` + `CalculationView.test.tsx` | Adaptervertrag, Blatt-Verhalten |
| `src-tauri/Cargo.toml` + `src/lib.rs` + `src/commands.rs` | `opc-io`-Dep, Import-Commands, Registrierung |
| `src-tauri/capabilities/default.json` | `dialog:default` ergänzen |

## Akzeptanzkriterien

1. Kein neuer `@tauri-apps/*`-Import außerhalb `tauriAdapter.ts`.
2. `calculate` läuft gegen den echten Command (Typecheck gegen die
   Rust-Signatur); die Ergebnisanzeige gruppiert nach `CostGroup`,
   zeigt Datei-Zuordnung und Fehlerrate-Positionen und formatiert deutsch.
3. Marge und Steuer erscheinen als **eigene** Gruppen; der Grand Total ist die
   Summe aller Positionen.
4. GCode-Import befüllt Druckzeit (Kommentarzeit bevorzugt) und
   Materiallänge; STL-Import befüllt das Volumen (Druckzeit bleibt manuell).
5. Speichern legt einen Schnappschuss an; nachträgliche Stammdaten-Änderung
   verändert die gespeicherte Kalkulation **nicht** (Test gegen Mock).
6. `npm run typecheck`, `lint`, `test -- --run`, `build` grün; Rust-Gates
   unverändert grün; Tauri-Build im Docker grün.
7. Deutsche Oberfläche durchgehend.

## Befehle

```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test --locked
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht (Entscheidungen zu Demo-Daten, Profil-Inline und
Playwright-Verzicht).
