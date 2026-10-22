# OpenPrintCost

**Kostenkalkulation für 3D-Druck-Aufträge — frei, lokal, quelloffen.**

OpenPrintCost berechnet, was ein 3D-Druck-Auftrag wirklich kostet: Material,
Maschinenzeit, Energie, Arbeitsschritte, Verbrauchsmittel, Marge und Steuer —
nachvollziehbar aufgeschlüsselt und als PDF/Excel exportierbar.

Die fachliche Ausrichtung folgt dem 3D-Druckkosten-Kalkulator von
Andreas Reitberger (ar3dp.de). Die Implementierung ist eine **eigenständige
Eigenentwicklung** unter Apache-2.0-Lizenz; es wurde kein GPL-Code übernommen.
Die Formelsemantik richtet sich an der Apache-2.0-Bibliothek
[`3dPrintCostCalculatorSharp`](https://github.com/AndreasReitberger/3dPrintCostCalculatorSharp)
aus, die Kommentarformate an
[`GcodeParserSharp`](https://github.com/AndreasReitberger/GcodeParserSharp).

![CI](https://github.com/monosystems/OpenPrintCost/actions/workflows/ci.yml/badge.svg)

## Funktionen

* **Stammdaten** — Drucker (Verfahren, Leistung, Verschleißkosten),
  Materialien (Dichte, Verpackung, Preis), Arbeitsschritte + Kategorien,
  Maschinenstundensätze (Abschreibung, Zins, Fix-/Variablenkosten),
  Kalkulationsprofile.
* **Kalkulationsblatt** — Dateien manuell oder per **GCode-/STL-Import**
  (PrusaSlicer, OrcaSlicer, BambuStudio, Cura, Simplify3D, IdeaMaker,
  CraftWare; Kommentarzeit gewinnt, sonst geometrische Simulation),
  Materialzuordnung, Arbeitsschritte, Zusatzartikel, Zuschläge, Marge,
  Steuer — alles je Datei plus Projektebene.
* **Er Ergebnis** — gruppierte Positionen mit Datei-Zuordnung und
  Fehlerrate-Kennzeichnung, Summen (Basis/Marge/Steuer/Gesamt).
* **Export** — PDF-Report und Excel-Arbeitsmappe (Positionen, Dateien,
  Übersicht) über den Dateidialog.
* **Lokal ohne Konto** — keine Anmeldung, kein Lizenzschlüssel, kein
  Netzzugriff. SQLite-Datei im Benutzerverzeichnis der App.
* **Exakt** — alle Geldbeträge als `Decimal` (kein `f64`), gerundet wird erst
  bei der Anzeige.

## Installation

Fertige Pakete liegen unter
[GitHub Releases](https://github.com/monosystems/OpenPrintCost/releases):

| System | Paket |
|---|---|
| Linux | `.deb` (Debian/Ubuntu) oder `.AppImage` |
| Windows | `.msi`-Installer |
| macOS (Apple Silicon) | `.dmg` |

Intel-Macs bauen aus den Quellen (siehe unten).

## Entwicklung

Voraussetzungen: aktuelle Rust-Toolchain (stable), Node.js 22+, systemweit —
je nach OS zusätzlich die Tauri-Systembibliotheken:

| OS | Pakete |
|---|---|
| Ubuntu/Debian | `libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev libayatana-appindicator3-dev libssl-dev` |
| Windows | WebView2 (vorinstalliert), [Rust](https://rustup.rs), Node.js |
| macOS | Xcode Command Line Tools, Rust, Node.js |

```bash
git clone https://github.com/monosystems/OpenPrintCost
cd OpenPrintCost

# Oberfläche (Browser, ohne Tauri-Binary — Mock statt Backend):
VITE_MOCK_API=1 npm run dev     # → http://localhost:1420

# Desktop-App (braucht die Systembibliotheken von oben):
npm install && npm run build
cargo build -p openprintcost
```

Gates vor jedem Commit (siehe [CONTRIBUTING.md](CONTRIBUTING.md)):

```bash
npm run typecheck && npm run lint && npm test -- --run && npm run build
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
```

Die Tauri-Crate baut lokal nur mit den Systembibliotheken; ohne sie läuft
alles außer `cargo build/clippy -p openprintcost` — dafür gibt es ein
Docker-Image (`Dockerfile` siehe Verlauf, Ubuntu 24.04 + webkit2gtk).

## Architektur

```text
crates/opc-core/    Rechenkern — pure Kostenberechnung (Decimal, UUID, Result statt Panic)
crates/opc-store/   Persistenz — Port (Traits) + SQLite-Adapter + In-Memory-Adapter
crates/opc-io/      Datei-Import — GCode-Parser + STL-Volumen (pure, ohne IO)
crates/opc-export/  Export — PDF + Excel als pure Funktionen (Bytes rein/raus)
src-tauri/          Tauri-Hülle — 35 Commands über Arc<dyn Store>, sonst keine Logik
src/                React + TypeScript + Tailwind — kennt Tauri nur über einen PlatformAdapter
```

Zentrale Invarianten (Details in [`docs/spec/`](docs/spec/)):

* `opc-core`, `opc-io` und `opc-export` sind **pure** (kein IO, kein Clock,
  kein globaler Zustand) und kompilieren nach `wasm32-unknown-unknown`.
* Geld ausschließlich `Decimal`, serialisiert als String.
* IDs sind UUID v4; Geldbeträge liegen in SQLite als `TEXT` (kein `REAL`).
* Das Frontend rechnet nicht — einzige Wahrheit ist `opc-core`.

## Dokumentation

* [`docs/spec/0001-mvp-core.md`](docs/spec/0001-mvp-core.md) — fachlicher Vertrag (Formeln)
* [`docs/spec/0002-block-plan.md`](docs/spec/0002-block-plan.md) — Blockübersicht
* [`docs/spec/0003-block-1-core.md`](docs/spec/0003-block-1-core.md),
  [`0005-block-2-store.md`](docs/spec/0005-block-2-store.md),
  [`0007-block-3-io.md`](docs/spec/0007-block-3-io.md),
  [`0008-block-4-frontend.md`](docs/spec/0008-block-4-frontend.md),
  [`0009-block-5-calculation.md`](docs/spec/0009-block-5-calculation.md),
  [`0011-block-6-export.md`](docs/spec/0011-block-6-export.md),
  [`0012-block-7-polish.md`](docs/spec/0012-block-7-polish.md),
  [`0013-block-8-oss.md`](docs/spec/0013-block-8-oss.md) — Bauabschnitte

**Hinweis zu den Formeln:** Die Formelsemantik orientiert sich an der
Apache-2.0-Bibliothek `3dPrintCostCalculatorSharp`. Bekannte Fehler der
Referenz (insbesondere die doppelte Materialberechnung bei Multi-Material-
Dateien) wurden **nicht** nachgebildet. Details in Spec 0001, Abschnitt 10.

## Mitmachen

Beiträge sind willkommen — siehe [CONTRIBUTING.md](CONTRIBUTING.md) und die
Issue-/PR-Templates. Bitte erst ein Issue anlegen, bevor du größere
Änderungen beginnst.

## Lizenz

[Apache-2.0](LICENSE) — mit ausdrücklichem Patentschutz und uneingeschränkter
kommerzieller Nutzbarkeit.
