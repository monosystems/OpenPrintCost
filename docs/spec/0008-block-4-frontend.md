# OpenPrintCost — Spec 0008: Block 4 (Frontend Stammdatenverwaltung)

Status: bereit zur Ausführung — 2026-10-22
Aufbauend auf `docs/spec/0001-mvp-core.md`, `docs/spec/0002-block-plan.md` und
Block 1–3 (Rechenkern, Persistenz + Tauri-Commands, Datei-Import).

## Einstufung

**MEDIUM** (kein Formelrisiko; Risiko liegt in der API-Verdrahtung und der
Eingabevalidierung). Eigenständiger Audit nach der Umsetzung ist Pflicht.

## Ziel

Die Stammdaten sind über die Oberfläche **lesbar, anlegbar, bearbeitbar und
löschbar** — über die fertigen Tauri-Commands, ohne dass eine Komponente
Tauri direkt kennt:

* Drucker (Verfahren, Leistung, Verschleißkosten …)
* Materialien (Dichte, Verpackung, Preis …)
* Arbeitsschritte + Kategorien (Typ, Preis, Menge/Dauer …)
* Maschinenstundensätze (alle Eingangsgrößen der Berechnung …)

## Nicht in diesem Block

Kein Kalkulationsblatt und keine Ergebnisdarstellung (Block 5), kein
Datei-Import in der Oberfläche (Block 5), kein PDF-/Excel-Export (Block 6),
keine Profile-/Firmendaten-Oberfläche (Block 7), kein Router (Tabs genügen),
kein Dark/Light-Umschalter (dunkles Schema ist Standard).

## Dateien

| Datei | Zweck |
|---|---|
| `src/api/types.ts` | TypeScript-Spiegel der Rust-Modelle (Enums als kebab-case-Strings, Beträge als String) |
| `src/api/platform.ts` | `PlatformAdapter`-Interface + `AdapterError`; einzige Stelle mit der Aufrufkonvention |
| `src/api/tauriAdapter.ts` | Einzige Datei mit `@tauri-apps/api`-Import (`invoke`) |
| `src/api/mockAdapter.ts` | In-Memory-Adapter (Browser-Entwicklung ohne Tauri, Tests) |
| `src/api/format.ts` | Anzeigeformatierung (deutsche Zahlen, Einheiten) |
| `src/components/ui.tsx` | Kleines UI-Kit: Modal, Field, TextInput, DecimalInput, Select, Buttons, EmptyState, ConfirmDialog |
| `src/components/PrinterView.tsx` | Druckerliste + Formular + Löschen |
| `src/components/MaterialView.tsx` | Materialliste + Formular + Löschen |
| `src/components/WorkstepView.tsx` | Arbeitsschritte + Kategorien (Anlegen/Löschen) + Formular |
| `src/components/HourlyRateView.tsx` | Stundensatzliste + Formular + Löschen (inkl. Live-Vorschau des Satzes) |
| `src/App.tsx` | App-Rahmen: Kopfzeile, Tab-Navigation, Fußzeile mit DB-Pfad |
| `src/main.tsx` | Mount + Adapterwahl (Mock via `VITE_MOCK_API=1`) |
| `src/api/*.test.ts(x)` | Vitest-Tests (Adaptervertrag, Komponentenverhalten) |
| `package.json` | `test`/`test:watch`-Skripte, `@tauri-apps/api`, Vitest, Testing Library |

## Akzeptanzkriterien

1. Keine Komponente außer `tauriAdapter.ts` importiert `@tauri-apps/api`
   (per Grep belegbar). Alle Daten fließen über `PlatformAdapter`.
2. Die Oberfläche läuft **ohne Tauri-Binary** im Browser
   (`VITE_MOCK_API=1 npm run dev`), belegt durch Screenshots-äquivalent
   (Komponententests) — die Plattformgrenze ist testbar.
3. Alle Geldbeträge und Messwerte werden als **String** transportiert
   (kein `number` für Geld/Mengen im Adapter); die Eingabefelder validieren
   das Format und lehnen Unfug mit einer deutschen Fehlermeldung ab.
4. CRUD je Entität funktioniert Ende-zu-Ende gegen den Mock (Vitest) und
   kompiliert gegen die echten Command-Namen/Signaturen (Typecheck).
5. Löschen fragt **immer** nach (ConfirmDialog); `NotFound`/`InUse`-Fehler
   des Backends werden als lesbare deutsche Meldung gezeigt, nicht als
   Rohtext.
6. Ein Stundensatz zeigt **live** den berechneten Satz (eigene Berechnung im
   Frontend? **Nein** — Anzeige `–` bis …). Korrektur: Die Vorschau ruft
   keinen Command auf; sie zeigt die Eingangsgrößen gruppiert. Ein
   berechneter Satz gehört in Block 5 (Engine). Das Formular gruppiert
   Fixkosten/variable Kosten/Zeitbasis.
7. `npm run typecheck`, `npm run lint`, `npm test -- --run`, `npm run build`
   sind grün.
8. Deutsche Oberfläche durchgehend; Beträge mit deutschem Dezimalkomma.

## Grenzen dieser Oberfläche

* **Kein Rechnen im Frontend.** Die einzige Quelle der Wahrheit ist
  `opc-core` (Block 5 ruft `calculate` auf). Das Stundensatz-Formular zeigt
  keine errechnete Zahl.
* **Keine Optimistic Updates**, die Fehler maskieren: Nach jedem
  Speichern/Löschen wird die Liste neu geladen; Fehler bleiben stehen, bis
  der Benutzer handelt.

## Befehle (im Repo-Root)

```bash
npm install
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

## Abschlussbericht

`STATUS`, `CHANGED`, `TESTS`, `ACCEPTANCE`, `CONCERNS`, `ASSUMPTIONS`.
`ASSUMPTIONS` ist Pflicht (Block 4 trifft Entscheidungen zu Validierung,
Fehlertexten und zur Adapterwahl).
