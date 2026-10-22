# OpenPrintCost — Spec 0013: Block 8 (OSS-Paketierung + Release)

Status: bereit zur Ausführung — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md` (Abschnitt 11.5), `docs/spec/0002-block-plan.md`
und Block 1–7.

## Einstufung

**SMALL** (kein Code-Risiko; Fleißarbeit + Pipeline). Eigenständiger Audit
nach der Umsetzung ist Pflicht.

## Ziel

Das Repository ist ein **glaubwürdiges Open-Source-Projekt**: Wer es findet,
versteht in fünf Minuten, was es tut, wie man es installiert, wie man
mitmacht — und jede Version liegt als installierbares Paket im GitHub
Release.

Fünf Liefergegenstände:

1. **`README.md` (final)** — Was, Screenshots-Ersatz (Funktionsliste),
   Installation pro OS (aus GitHub Releases), Entwicklung (Voraussetzungen
   je OS, Mock-Modus, Gates), Architektur-Überblick, Lizenz, Mitmachen-Link.
2. **`CONTRIBUTING.md`** — Setup, Gates (exakte Befehle inkl. Docker für
   Tauri), Commit-Stil, PR-Checkliste, Release-Prozess (Maintainer).
3. **Issue-/PR-Templates** — Bug-Report, Feature-Request, PR-Checkliste.
4. **Release-Workflow** (`.github/workflows/release.yml`) — baut bei Tags
   `v*` installierbare Pakete: Linux (`.deb`, AppImage), Windows
   (`.msi`/`.exe`), macOS (`.dmg`, arm64). Versionskonsistenz-Check
   (`package.json` = `tauri.conf.json` = `Cargo.toml` = Tag).
5. **Bundle-Vervollständigung** — `icon.icns` für macOS erzeugen,
   `tauri.conf.json` prüfen (Kategorie, Icons, Targets).

## Nicht in diesem Block

Kein Auto-Updater (kein Signing), kein Intel-macOS-Bundle (nur arm64;
Intel baut aus Quellen — dokumentiert), keine Screenshots im README (kein
Browser in dieser Umgebung; Platzhalter-Text, was wo zu sehen ist), kein
Changelog-Generator, kein crates.io-Publish.

## Dateien

| Datei | Zweck |
|---|---|
| `README.md` | Finale Fassung |
| `CONTRIBUTING.md` | Mitmachen-Anleitung |
| `.github/ISSUE_TEMPLATE/bug_report.md` | Bug-Template |
| `.github/ISSUE_TEMPLATE/feature_request.md` | Feature-Template |
| `.github/pull_request_template.md` | PR-Checkliste |
| `.github/workflows/release.yml` | Release-Pipeline |
| `src-tauri/icons/icon.icns` | macOS-Icon |
| `docs/spec/0013-block-8-oss.md` | Diese Spec |

## Akzeptanzkriterien

1. `README` nennt Installation, Entwicklung, Architektur, Lizenz — ohne
   tote Links (alle referenzierten Dateien existieren).
2. Release-Workflow ist valides YAML und referenziert nur existierende
   Aktionen, Skripte und Pfade.
3. Versionscheck-Skript läuft lokal grün (alle drei Versionen + simulierter Tag).
4. In Docker läuft `tauri build` für Linux erfolgreich durch und erzeugt
   `.deb` + `.AppImage` (Substitut für das Gate „reale Release-Artefakte“ —
   GitHub Releases selbst sind von hier aus nicht auslösbar).
5. `icon.icns` existiert und ist in `tauri.conf.json` referenziert.
6. Alle bisherigen Gates bleiben grün.

## Befehle

```bash
npm run build
export PATH="$HOME/.cargo/bin:$PATH"
cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test --locked
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht.
