//! Ergebnismodell — Positionen und Summen einer Kalkulation.
//!
//! Das Ergebnis ist eine **flache, geordnete Liste** von
//! [`CostPosition`]-en. Die Reihenfolge der Positionen ist die vom Rechenkern
//! fest vorgegebene Kostenreihenfolge (Spec 0001, Abschnitte 4.2–4.9); die
//! Oberfläche gruppiert sie lediglich nach [`CostGroup`].
//!
//! Beträge in Positionen sind **exakte** `Decimal`-Werte. Gerundet wird erst
//! bei der Anzeige (kaufmännisch auf zwei Nachkommastellen).

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Kostengruppe einer Position (Spec 0001, Abschnitt 6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CostGroup {
    /// Materialkosten.
    Material,
    /// Maschinenkosten (Maschinenstundensatz × Druckzeit).
    Machine,
    /// Energiekosten.
    Energy,
    /// Verfahrensspezifische Zuschläge (Düse, Druckplatte, Materialwechsel).
    ProcessSurcharge,
    /// Arbeitsschritte.
    Worksteps,
    /// Zusatzartikel.
    AdditionalItems,
    /// Handlungspauschale.
    HandlingFee,
    /// Prozentuale Zuschläge.
    CustomSurcharge,
    /// Gewinnmarge.
    Margin,
    /// Steuer.
    Tax,
    /// Gesamtkosten.
    Total,
}

/// Eine einzelne Kostenposition des Ergebnisses.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CostPosition {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Kostengruppe.
    pub group: CostGroup,
    /// Bezeichnung der Position.
    pub label: String,
    /// Zusatzinformation, z. B. „1,00 kg PLA zu 0,025 €/g“.
    pub detail: Option<String>,
    /// Menge der Position, falls sinnvoll.
    pub quantity: Option<Decimal>,
    /// Einheit der Menge, falls sinnvoll.
    pub unit: Option<String>,
    /// Betrag in Euro (exakt, ungerundet).
    pub amount: Decimal,
    /// Datei, auf die sich die Position bezieht — `None` = Projektebene.
    pub file_id: Option<Uuid>,
    /// Ursprungsentität (Material, Drucker, Arbeitsschritt …).
    pub source_id: Option<Uuid>,
    /// Kennzeichnet eine Position aus der Fehlerrate.
    pub is_fail_rate: bool,
    /// Kennzeichnet eine Position, die von der Margenberechnung ausgenommen ist.
    pub excluded_from_margin: bool,
}

impl CostPosition {
    /// Erzeugt eine Position auf Projektebene.
    pub fn new(group: CostGroup, label: impl Into<String>, amount: Decimal) -> Self {
        Self {
            id: Uuid::new_v4(),
            group,
            label: label.into(),
            detail: None,
            quantity: None,
            unit: None,
            amount,
            file_id: None,
            source_id: None,
            is_fail_rate: false,
            excluded_from_margin: false,
        }
    }
}

/// Zusammenfassung der Mengengerüste je Datei.
///
/// Die Fehlerrate erzeugt zusätzliche Druckzeit und zusätzliches Material
/// (Spec 0001, Abschnitt 4.10). Deren Auswirkung auf Druckzeit und Gewicht
/// wird hier ausgewiesen; die daraus entstehenden Kosten stehen als eigene
/// Positionen in der Positionsliste.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileSummary {
    /// Zugehörige Datei.
    pub file_id: Uuid,
    /// Dateiname.
    pub file_name: String,
    /// Stückzahl.
    pub quantity: u32,
    /// Effektive Druckzeit in Stunden (`druckzeit_basis`).
    pub print_time_hours: Decimal,
    /// Druckzeit-Anteil aus der Fehlerrate in Stunden (`druckzeit_fehler`).
    pub print_time_hours_fail: Decimal,
    /// Materialverbrauch in Gramm (`material_g_basis`).
    pub material_g: Decimal,
    /// Materialverbrauch aus der Fehlerrate in Gramm (`material_g_fehler`).
    pub material_g_fail: Decimal,
}

/// Das vollständige Ergebnis einer Kalkulation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculationResult {
    /// Identität der Kalkulation.
    pub id: Uuid,
    /// Projektname.
    pub project_name: String,
    /// Erstellungszeitpunkt (ISO-8601-String, vom Aufrufer geliefert).
    pub created_at: Option<String>,
    /// Geordnete Liste aller Kostenpositionen inkl. Gesamtkosten.
    pub positions: Vec<CostPosition>,
    /// Basiskosten vor Marge und Steuer (exakt).
    pub base_total: Decimal,
    /// Summe der Marge (exakt).
    pub margin_total: Decimal,
    /// Summe der Steuer (exakt).
    pub tax_total: Decimal,
    /// Gesamtkosten (exakt).
    pub total: Decimal,
    /// Angewandter Maschinenstundensatz in €/h.
    pub machine_hour_rate: Decimal,
    /// Mengengerüste je Datei.
    pub files: Vec<FileSummary>,
}

impl CalculationResult {
    /// Summiert alle Positionen einer Gruppe — ohne die Gesamtposition.
    pub fn group_total(&self, group: CostGroup) -> Decimal {
        self.positions
            .iter()
            .filter(|position| position.group == group)
            .map(|position| position.amount)
            .sum()
    }
}
