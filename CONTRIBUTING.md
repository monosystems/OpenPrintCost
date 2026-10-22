# Mitmachen bei OpenPrintCost

Danke für dein Interesse! Diese Anleitung fasst zusammen, wie du effektiv
beitragen kannst. Bei Fragen: Issue aufmachen — lieber einmal zu viel gefragt
als schweigend in die falsche Richtung gebaut.

## Bevor du beginnst

Für größere Änderungen bitte **zuerst ein Issue** anlegen und kurz skizzieren,
was du vorhast. So vermeiden wir doppelte Arbeit und Design-Brüche. Kleine
Fixes (Tippfehler, Doku) können direkt als PR kommen.

## Entwicklungsumgebung

Voraussetzungen: Rust-Toolchain (stable, siehe `rust-toolchain.toml`),
Node.js 22+, und für den Tauri-Build die Systembibliotheken aus der
[README](README.md) (Ubuntu: `libwebkit2gtk-4.1-dev libgtk-3-dev
librsvg2-dev libayatana-appindicator3-dev libssl-dev`).

```bash
git clone https://github.com/monosystems/OpenPrintCost
cd OpenPrintCost
npm install

# Schnelles Arbeiten ohne Tauri-Binary (Mock statt Backend):
VITE_MOCK_API=1 npm run dev
```

## Gates — vor jedem Commit

Frontend (Repo-Root):

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Rust (Repo-Root, `cargo` ggf. via `export PATH="$HOME/.cargo/bin:$PATH"`):

```bash
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings
cargo test --locked
```

Die Tauri-Crate (`-p openprintcost`) baut lokal nur **mit** den
Systembibliotheken; ohne sie ist das kein Fehler deinerseits — die CI prüft
sie (Job `tauri`). Wer Docker hat, kann lokal prüfen:

```bash
docker run --rm -v "$PWD":/app -v ~/.cache/opc-tauri-target:/app/target \
  <image-mit-webkit2gtk> bash -lc \
  "cd /app && export PATH=/root/.cargo/bin:\$PATH && \
   cargo clippy -p openprintcost --all-targets --locked -- -D warnings && \
   cargo build -p openprintcost --locked"
```

## Regeln, die immer gelten

* **Kein `unwrap`/`expect` in Produktionspfaden** — Fehler sind `Result`
  (`CalcError`, `StoreError`, `IoError`, `ExportError`, `AdapterError`).
  Tests und Doc-Beispiele dürfen `expect` nutzen.
* **Geld ausschließlich `Decimal`**, serialisiert als String. `f64` nur für
  physikalische Messwerte, mit expliziter Konvertierung an der Grenze.
* **`opc-core`, `opc-io` und `opc-export` bleiben pure** — kein IO, kein
  Clock, kein globaler Zustand. Wer Clock/IO braucht, gehört in die Hülle
  (`src-tauri`) oder den Adapter.
* **Kein Tauri-Import außerhalb `src/api/tauriAdapter.ts`** —
  per `grep -rn "@tauri-apps" src --include="*.tsx" | grep -v tauriAdapter.ts`
  prüfbar (muss leer sein).
* **Deutsche UI-Texte nur in `src/i18n/de.ts`** (Tests ausgenommen).
* **Migrationen werden nie geändert**, nur fortgeschrieben (`crates/opc-store/
  src/sqlite/migrations/` + Eintrag in `migrations.rs`).
* Neue Commands in `src-tauri` brauchen: Registrierung in `lib.rs`,
  Adapter-Methode in `platform.ts` + `tauriAdapter.ts` + `mockAdapter.ts`
  und einen Vitest, der den Mock-Pfad abdeckt.

## Commit-Stil

Kurze, imperative Betreffzeilen mit Scope-Präfix:

* `feat(store): …` — neues Verhalten
* `fix(io): …` — Fehlerbehebung
* `chore(deps): …` — Abhängigkeiten
* `docs(spec): …` — Spezifikation/Dokumentation
* `test(frontend): …` — nur Tests

Ein Commit = ein Thema. Spec-Änderungen und die zugehörige Implementierung
dürfen getrennt committen werden.

## Pull-Requests

* Beschreibung: Was, warum, wie verifiziert (Gates auflisten).
* Checkliste (siehe PR-Template): Gates grün, keine neuen Warnungen,
  Spec aktualisiert (falls fachlich relevant), kein Scope-Creep.
* Review: mindestens ein Maintainer schaut drüber; fachliche Zweifel werden
  im PR ausdiskutiert, nicht nachträglich.

## Releases (Maintainer)

1. Versionen angleichen: `package.json`, `src-tauri/tauri.conf.json`,
   `Cargo.toml` (Workspace) — alle drei identisch, z. B. `0.2.0`.
2. Committen, Tag setzen (`git tag v0.2.0`), pushen (`git push --tags`).
3. Der Release-Workflow (`.github/workflows/release.yml`) baut `.deb`,
   AppImage, `.msi` und `.dmg` und hängt sie ans GitHub Release.
4. Release-Notes schreiben: Was ist neu, was ist kaputt gegangen, danke an
   Beitragende.

## Verhaltenskodex

Sei sachlich, präzise und respektvoll. Technische Richtigkeit schlägt
Höflichkeitsfloskeln — aber niemals auf Kosten von Menschen. Wer andere
herabwürdigt oder Beiträge blockiert, statt sie zu verbessern, ist hier
falsch.
