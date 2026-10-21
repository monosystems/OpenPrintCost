# OpenPrintCost — Spec 0001: MVP-Kern (fachlicher Vertrag)

Status: freigegeben (2026-10-21)
Feature-orientiert am ar3dp-3D-Druckkosten-Kalkulator (NXG/3.0), eigene Implementierung.

## 1. Ziel

Lokal lauffähiger Desktop-Kalkulator (Tauri) für 3D-Druck-Kalkulationen für
Dienstleister und Hobby-Anwender. Kern: Kosten aus **Druckzeit, Materialverbrauch,
Maschinenstundensatz, Energie, Arbeitsschritten, Fehlerrate, Marge und Steuer**
berechnen, nachvollziehbar aufgeschlüsselt anzeigen und als PDF/Excel exportieren.

Nicht im MVP: Login, Mandanten, Cloud-Sync, Slicer-CLI-Integration, OctoPrint,
Kundenverwaltung, LexOffice, Pulver-/Harz-Sonderverfahren.

## 2. Fachliche Objekte

| Objekt | Pflichtfelder | Optional |
|---|---|---|
| **Drucker** | Modellbezeichnung, Verfahren (FDM/SLA/Powder), Materialart, max. Leistung (W), Bauvolumen (mm³), Kaufpreis (€), Maschinenstundensatz-Referenz | Hersteller, eigene Eigenschaften |
| **Material** | Materialart (Filament/Harz/Pulver), Typ (PLA/PETG/…), Bezeichnung, Dichte (g/cm³), Verpackungsgröße + Einheit (z. B. 1 kg), Preis (€) | Hersteller, Shop-Link, eigene Eigenschaften |
| **Arbeitsschritt** | Name, Kategorie, Berechnungstyp (pro Stunde / pro Stück / pro Auftrag), Preis (€) | zeitliche Zuordnung (vor/nach/sonstiges) |
| **Maschinenstundensatz** | Name, Zeitbasis (pro Jahr/pro Monat), Maschinenstunden je Zeitbasis, Wiederbeschaffungskosten (€), Nutzungsdauer (Jahre), Zinssatz (%), Fixkosten, Variable Kosten | freier Stundensatzwert |
| **Kalkulation** | Projektname, gewählte Dateien, Drucker, Material, Arbeitsschritte, Parameter | Notizen |
| **Kalkulationsprofil** | FailRate (%), Steuersatz (%), Gewinnmarge (%), Handlungspauschale (€), Energiekosten (€/kWh), Anwendungsflags | — |

Drucker, Material, Arbeitsschritt, Stundensatz und Profil sind wiederverwendbare
Stammdaten. Kalkulationen sind eigenständige Dokumente mit Schnappschuss der
verwendeten Stammdaten, damit spätere Änderungen historische Kalkulationen nicht
verändern.

## 3. Mengen- und Einheitenlogik

- **Druckzeit**: Stunden (Dezimal). Quelle: GCode-Parser oder manuell.
- **Volumen**: cm³ (Dezimal). Quelle: STL-Volumenberechnung oder GCode.
- **Gewicht**: g. `gewicht_g = volumen_cm3 × dichte_g_cm3`.
- **Materialverbrauch**: `verbrauch_g = gewicht_g × stückzahl`.
- **Preis pro Gramm**: `preis_pro_gramm = materialpreis / (verpackungsgröße × einheitenfaktor)`.
  Einheitenfaktor: kg = 1000, g = 1, lb = 453,592, oz = 28,3495.

## 4. Rechenformeln (AUTORITATIV)

Reihenfolge der Kostenblöcke ist fix. Jeder Block erzeugt eigene Positionen in der
Ergebnisliste — kein Block wird in einen anderen eingerechnet.

### 4.1 Grundlagen

```
druckzeit_basis      = druckzeit_datei
                       × (multipliziere_mit_stückzahl ? stückzahl × druckzeit_faktor : 1)
druckzeit_fehler     = druckzeit_basis × fehlerrate / 100
material_g_basis     = gewicht_g × stückzahl
material_g_fehler    = material_g_basis × fehlerrate / 100
```

### 4.2 Materialkosten

```
preis_pro_gramm      = materialpreis / (verpackungsgröße × einheitenfaktor)
materialkosten_basis  = material_g_basis × preis_pro_gramm
materialkosten_fehler = material_g_fehler × preis_pro_gramm
```

Bei mehreren Materialien (Multi-Material) wird jedes Material separat berechnet;
ein optionaler Schalter `materialien_kombinieren` summiert sie zu einer Position.

### 4.3 Maschinenkosten

```
maschinenstundensatz  = siehe 4.6
maschinenkosten       = maschinenstundensatz × druckzeit_basis
maschinenkosten_fehl  = maschinenstundensatz × druckzeit_fehler
```

### 4.4 Energiekosten

```
verbrauch_kwh         = druckzeit_h × leistung_w / 1000 × (leistungsgrad_pct / 100)
energiekosten         = verbrauch_kwh × energiepreis_pro_kwh
energiekosten_fehl    = verbrauch_kwh_fehler × energiepreis_pro_kwh
```

Anwendung nur, wenn `energiekosten_anwenden` gesetzt.

### 4.5 Arbeitsschritte

```
pro_stunde:   kosten = stundensatz × dauer_stunden
pro_stück:    kosten = stückpreis × menge × stückzahl_der_datei
pro_auftrag:  kosten = pauschalpreis × menge           (einmal je Kalkulation)
```

Arbeitsschritte vom Typ *pro Stück* werden je Datei positioniert, die übrigen
auf Projektebene.

### 4.6 Maschinenstundensatz (Berechnung)

```
abschreibung   = wiederbeschaffungskosten / nutzungsdauer_jahre
zins           = (wiederbeschaffungskosten / 2) / 100 × zinssatz

# wenn fester_stundensatz gesetzt (>= 0):  stundensatz = fester_stundensatz
# wenn maschinenstunden <= 0:            stundensatz = 0
# sonst (zeitbasis pro Jahr: faktor = 1, pro Monat: faktor = 12):

stundensatz = ( abschreibung
              + zins
              + (wartung + miete + strom + zusatzkosten)              × faktor
              + (wartung_var + strom_var + zusatzkosten_var)          × faktor
              ) / ( maschinenstunden × faktor )
```

Abschreibung und Zins sind Jahreswerte und werden **nicht** mit `faktor` multipliziert.
Die Formel ist maßgeblich an der Apache-2.0-Referenzbibliothek
(`AndreasReitberger/3dPrintCostCalculatorSharp`) ausgerichtet.

### 4.7 Verfahrensspezifische Zuschläge (FDM)

```
düsenverschleiß     = kosten_düse × stückzahl        (je Datei)
druckplattenverschleiß = kosten_platte × stückzahl   (je Datei)
materialwechsel     = kosten_materialwechsel × anzahl_materialwechsel (je Datei)
```

### 4.8 Handlungspauschale

```
je_datei:  pauschale × stückzahl   (Position je Datei)
einmal:    pauschale               (eine Position auf Projektebene)
```

### 4.9 Marge, Custom-Zuschläge, Steuer

```
# Reihenfolge innerhalb einer Datei:
kosten_basis  = summe(material, maschine, energie, verfahrenszuschläge, arbeitsschritte_pro_stück, artikel)
                + pauschale_je_datei
                + custom_zuschläge_prozent(vor_marge)   # je Order: prozentsatz × kosten_sofar
marge         = (kosten_basis − ausgeschlossene_posten) × marge_prozent / 100
kosten_nach_marge = kosten_basis + marge
custom_nach_marge = prozentsatz × kosten_nach_marge
steuer        = (kosten_nach_marge + custom_nach_marge) × steuersatz / 100
```

- Marge und Steuer sind **eigene Positionen**, nie im Basispreis versteckt.
- Die Steuer wird auf die Summe inkl. Marge berechnet (Referenzverhalten).
- Ausschlüsse: Maschinen-, Material- und/oder Arbeitsschrittkosten können von der
  Margenberechnung ausgenommen werden (Schalter je Block).
- Positionssummen werden erst am Ende kaufmännisch gerundet, nicht pro Zwischenschritt.

### 4.10 Fehlerrate

Die Fehlerrate erzeugt **zusätzliche Positionen** (Druckzeit, Material, Maschine,
Energie) für den Anteil, der beim Druck verworfen wird. Sie wird nicht auf den
Endpreis aufgeschlagen. Anzeige: eigener Block in der Ergebnisliste.

## 5. Dateien / Druckinformationen

- **GCode**: Parser liest Slicer-Kommentare (u. a. PrusaSlicer, Cura, OrcaSlicer,
  BambuStudio) für Druckzeit, Filamentlänge und -volumen. Ohne Kommentare:
  geometrische Simulation der G-Befehle (G0/G1: Distanz/Geschwindigkeit, E-Extrusion,
  Z-Layer) als Näherung.
- **STL**: Volumenberechnung aus dem Mesh (Tetraeder-Summation) als Materialbasis,
  wenn kein GCode vorliegt. Druckzeit dann manuell (Stunden).
- **Manuelle Druckinformation**: Datei ohne Parser (z. B. SLA-Drucker) mit manuell
  gesetzter Druckzeit und optionalem Gewicht.

## 6. Ergebnisdarstellung

Ergebnisliste gruppiert in: Material · Maschine · Energie · Verfahrenszuschläge ·
Arbeitsschritte · Zusatzartikel · Handlungspauschale · Marge · Steuer ·
**Gesamtkosten**. Jede Position zeigt Bezeichnung, Menge/Einheit und Betrag in EUR.
Summenzeile je Gruppe plus Grand Total. Negative Werte (z. B. Rabatt) bleiben sichtbar.

## 7. Export

- **PDF**: Kalkulationsreport mit Kopfdaten (Projekt, Datum, Firma), Positionen,
  Summen. Erzeugt serverseitig in Rust (`printpdf`), Ausgabe über Dateidialog.
- **Excel**: Tabelle mit Positionen, Summen und Formeln-freien Werten
  (`rust_xlsxwriter`), plus Reiter Druckinfo und Stammdaten.

## 8. Stammdaten-Persistenz

SQLite lokal, eine Datei im Benutzerdatenverzeichnis der App. Tabellen:
`printers`, `materials`, `worksteps`, `workstep_categories`, `hourly_rates`,
`calculation_profiles`, `calculations`, `calculation_files`.
Angewandte Migrationen werden nie geändert, nur fortgeschrieben.

## 9. Annahmen (bewusste Festlegungen)

1. Die Formeln in Abschnitt 4 folgen der Apache-2.0-Referenzbibliothek. Wo das
   Original eine Besonderheit hat (z. B. Zins in der Lebensdauersumme), wird die
   Referenzformel übernommen und in Code und Test dokumentiert.
2. Fehlerrate, Marge und Steuer sind immer sichtbare eigene Positionen.
3. Die Maschinenstundensatz-Berechnung liefert einen Wert in €/h; der freie
   Stundensatz überschreibt die Berechnung.
4. Mengen-Einheiten des Materials (kg/g/lb/oz) werden über einen Einheitenfaktor
   unterstützt, das Materialmodell speichert Preis + Verpackungsgröße + Einheit.
5. Berechnung in `Decimal` (Rust), Serialisierung als Dezimalstring an das Frontend.

## 10. Referenz-Audit (Stand der Recherche)

- Desktop-App der Referenz: **GPL-3.0** → kein Code wird übernommen.
- Core-Bibliothek `3dPrintCostCalculatorSharp`: **Apache-2.0** → Formelsemantik
  und Reihenfolge orientieren sich daran, Umsetzung ist eigenständig.
- GCode-Parser `GcodeParserSharp`: **Apache-2.0** → gleiches Vorgehen.
- Website der Referenz wird zum 31.12.2026 eingestellt.
