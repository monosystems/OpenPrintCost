# OpenPrintCost — Spec 0007: Block 3 (Datei-Import `opc-io`)

Status: in Arbeit — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md` (fachlicher Vertrag, Abschnitt 5),
`docs/spec/0002-block-plan.md` (Blockübersicht) und Block 1 + 2.

## Einstufung

**LARGE** (neuer Parser, Formatvielfalt). Eigenständiger Audit nach der
Umsetzung ist Pflicht.

## Ziel

Druckdateien **rein lesend** einlesen und strukturierte Mengengerüste für den
Rechenkern liefern — ohne Dateisystem, ohne Netzwerk, ohne globalen Zustand.
Alle Tests laufen ohne Fixture-Dateien auf der Platte: Fixtures werden im Test
erzeugt.

Zwei Liefergegenstände in einer Crate (`crates/opc-io`):

1. **STL-Volumenberechnung** — binär und ASCII, Tetraeder-Summation,
   Ergebnis in cm³.
2. **GCode-Parser** — zwei Stufen: Slicer-Kommentare (exakt, gewinnen immer),
   ersatzweise geometrische Simulation der Fahrbewegungen (Näherung,
   gekennzeichnet).

## Nicht in diesem Block

Kein Schreiben von Dateien, kein Slicer-Aufruf, keine OctoPrint-Anbindung,
kein Harz-/Pulver-Sonderverfahren über das in Abschnitt 5 Genannte hinaus.
`opc-io` hängt von **keiner** anderen Workspace-Crate ab (nur `rust_decimal`
für die Mengengerüste und `thiserror` für Fehler).

## Dateien

| Datei | Zweck |
|---|---|
| `crates/opc-io/Cargo.toml` | Paketmanifest (`opc-io`) |
| `crates/opc-io/src/lib.rs` | Crate-Doku, Modul-Exports |
| `crates/opc-io/src/error.rs` | `IoError` (thiserror): `Empty`, `Unsupported`, `Corrupt` |
| `crates/opc-io/src/stl.rs` | `Triangle`, `parse_stl`, `StlInfo` |
| `crates/opc-io/src/gcode.rs` | `parse_gcode`, `GcodeInfo`, `FilamentUsage` |
| `crates/opc-io/tests/io.rs` | Integrationstests mit erzeugten Fixtures |

## Akzeptanzkriterien

1. `opc-io` ist **pure**: kein Dateisystem, kein Netzwerk, kein globaler
   Zustand, kein Clock. Signaturen: `parse_stl(&[u8])`, `parse_gcode(&str)`.
2. STL binär **und** ASCII liefern für dasselbe Mesh dasselbe Volumen (bis auf
   die Text-Rundungsstelle).
3. Das STL-Volumen eines 10-mm-Würfels ist exakt `1` cm³ — kein
   Fließkomma-Rest in der Ausgabe.
4. `parse_stl(&[])` liefert `Err(IoError::Empty)`, keine Panic.
5. Abgeschnittene und inhaltsleere Dateien liefern `Err(IoError::Corrupt)`.
6. Ein GCode mit PrusaSlicer-Kommentaren liefert die Kommentarzeit
   (`used_comments == true`); ein GCode ohne Kommentare liefert die
   simulierte Zeit (`used_comments == false`).
7. Ein Cura-GCode mit `;TIME:`-Kommentar liefert die Kommentarzeit in Stunden.
8. Die Simulation versteht `G0`/`G1`, `G90`/`G91`, `M82`/`M83`, `G92` und
   `G92.1`-nahe Rücksetzungen; unbekannte Befehle werden ignoriert, nicht
   abgebrochen.
9. `cargo test` ist grün, `cargo clippy --all-targets -- -D warnings` ist
   warnungsfrei, `cargo fmt --all --check` zeigt keinen Diff.
10. Alle Geldbeträge gibt es hier nicht — aber alle **Mengen** verlassen die
    Crate als `Decimal` (exakt über String-Umwandlung), `f64` nur intern für
    die Geometrie.

## Referenz-Audit (am Quelltext verifiziert, 2026-10-22)

Die Kommentarformate richten sich an der Apache-2.0-Bibliothek
`GcodeParserSharp` aus. Verifiziert wurden:

| Thema | Verifiziertes Verhalten |
|---|---|
| Slicer-Erkennung | Schlüsselwörter in den ersten 30 Kommentarzeilen, erste Übereinstimmung gewinnt (`PrusaSlicer`, `OrcaSlicer`, `BambuStudio`, `Cura`/`Cura_SteamEngine`, `Simplify3D`, `ideaMaker`, …) |
| Zeit (Prusa/Orca/Bambu) | `estimated printing time (normal mode) = 1h 12m 44s`; Orca: `model printing time: …; total estimated time: …` — die **Gesamtschätzung** gewinnt |
| Zeit (Cura/IdeaMaker) | `;TIME:…` / `;Print Time: …` in **Sekunden** → /3600 |
| Zeit (Simplify3D/CraftWare) | `Build time: 7 hours 39 minutes`; CraftWare `Time: …` in **Minuten** → /60 |
| Filament (Prusa/Orca) | `filament used [mm] = …` (mehrere durch `,` oder `|`), `filament used [cm3] = …`; Standarddurchmesser 1,75 mm, Ergebnis in mm bzw. cm³, gerundet |
| Filament (Cura) | `Filament used: 25.3127m` mit Einheit `m` → ×1000, `cm` → ×10, `mm` → unverändert, `km` → ×1_000_000 |
| Filament (Simplify3D) | `Filament length: … mm …` |
| Simulation | nur `G0`/`G1` erzeugen Bewegung; `F` in mm/min (Standard 4000); `E` absolut (`M82`/`G90`) oder relativ (`M83`/`G91`); `G92` setzt die E-Referenz; neue Z-Höhe = neue Schicht |

### Bewusste Abweichungen von der Referenz

1. **Konstantes Geschwindigkeitsmodell.** Die Referenz rechnet mit einem
   beschleunigungsbasierten Trapezmodell; `opc-io` rechnet konstant
   (Zeit = Distanz / Vorschub). Dokumentierte Näherung — deterministisch und
   von Hand nachrechenbar.
2. **`filament used [g]` wird nicht gelesen.** Die Referenz enthält hier
   einen Fehler (das `[g]`-Muster entspricht dem `[mm]`-Muster und greift
   nie). Gramm brauchen die Dichte aus den Stammdaten — zur Importzeit
   unbekannt. Die Umrechnung geschieht im Rechenkern (`opc-core`).
3. **BambuStudio ohne Filamentkommentare** (wie in der Referenz: die
   Auslesezweige sind dort auskommentiert) → die Simulation liefert die
   Längen.
4. **FlashForge/KISSlicer/Skeinforge/Voxelizer** ohne Kommentarwerte →
   ebenfalls Simulation. Kein Format wird abgebrochen, nur weil Kommentare
   fehlen.

## Befehle

```bash
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test -p opc-io
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht (Block 3 trifft Entscheidungen zu Einheiten,
Kommentarvorrang und Simulationsgrenzen).
