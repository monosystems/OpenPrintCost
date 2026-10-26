//! Eingabemodell einer Kalkulation.
//!
//! Eine Kalkulation ist ein **eigenständiges Dokument**: Sie enthält einen
//! Schnappschuss der verwendeten Stammdaten (Drucker, Material, Arbeitsschritte,
//! Stundensatz), damit spätere Änderungen an den Stammdaten das Ergebnis
//! historischer Kalkulationen nicht verändern (Spec 0001, Abschnitt 2).

use crate::model::hourly_rate::HourlyRate;
use crate::model::material::Material;
use crate::model::printer::Printer;
use crate::model::workstep::Workstep;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Geltungsbereich der Handlungspauschale (Spec 0001, Abschnitt 4.8).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum HandlingFeeScope {
    /// Pauschale je Datei — `pauschale × stückzahl`, eine Position je Datei.
    PerFile,
    /// Pauschale einmal je Kalkulation — genau eine Position.
    Once,
}

/// Zeitpunkt, zu dem ein prozentualer Zuschlag wirkt (Spec 0001, Abschnitt 4.9).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SurchargeTiming {
    /// Zuschlag wird **vor** der Marge berechnet — `prozentsatz × kosten_sofar`.
    BeforeMargin,
    /// Zuschlag wird **nach** der Marge berechnet — `prozentsatz × kosten_nach_marge`.
    AfterMargin,
}

/// Ein prozentualer Zuschlag auf die bisherigen Kosten.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CustomSurcharge {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Name des Zuschlags, z. B. „Rüstauftrag“.
    pub name: String,
    /// Zuschlag in Prozent.
    pub percent: Decimal,
    /// Zeitpunkt der Wirksamkeit.
    pub timing: SurchargeTiming,
}

impl CustomSurcharge {
    /// Erzeugt einen Zuschlag mit zufälliger UUID v4.
    pub fn new(name: impl Into<String>, percent: Decimal, timing: SurchargeTiming) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            percent,
            timing,
        }
    }
}

/// Ein zusätzlicher Artikel (z. B. Verpackung, Schraube, Kabel).
///
/// Ohne `file_id` wirkt der Artikel auf Projektebene, mit `file_id` wird er der
/// jeweiligen Datei zugeordnet.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AdditionalItem {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Bezeichnung des Artikels.
    pub name: String,
    /// Stückpreis in Euro.
    pub price: Decimal,
    /// Menge.
    pub quantity: Decimal,
    /// Optionale Zuordnung zu einer Datei — `None` bedeutet Projektebene.
    pub file_id: Option<Uuid>,
}

impl AdditionalItem {
    /// Erzeugt einen Artikel auf Projektebene mit zufälliger UUID v4.
    pub fn new(name: impl Into<String>, price: Decimal, quantity: Decimal) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            price,
            quantity,
            file_id: None,
        }
    }
}

/// Materialzuordnung einer Datei.
///
/// `weight_g` überschreibt die aus Volumen und Dichte berechnete Masse. Ohne
/// explizites Gewicht gilt `gewicht_g = volumen_cm3 × dichte_g_cm3`
/// (Spec 0001, Abschnitt 3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileMaterial {
    /// Material-Schnappschuss.
    pub material: Material,
    /// Optionales explizites Stückgewicht in Gramm.
    pub weight_g: Option<Decimal>,
}

impl FileMaterial {
    /// Erzeugt eine Materialzuordnung mit zufälliger UUID im Material.
    pub fn new(material: Material) -> Self {
        Self {
            material,
            weight_g: None,
        }
    }
}

/// Eine zu druckende Datei innerhalb der Kalkulation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculationFileInput {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Anzeigename der Datei, z. B. „Gehäuse.stl“.
    pub file_name: String,
    /// Stückzahl dieser Datei.
    pub quantity: u32,
    /// Druckzeit je Stück in Stunden.
    pub print_time_hours: Decimal,
    /// Volumen eines Stücks in cm³ (z. B. aus einem STL-Mesh).
    pub volume_cm3: Option<Decimal>,
    /// Außenmaße eines Stücks in mm (Breite X, Tiefe Y, Höhe Z).
    ///
    /// Wird beim STL-Import aus dem Begrenzungsrahmen übernommen und dient
    /// dem Druckbarkeits-Check gegen das Bauvolumen des Druckers.
    pub dimensions_mm: Option<[Decimal; 3]>,
    /// Optionales explizites Stückgewicht in Gramm (z. B. bei Harz).
    pub weight_g: Option<Decimal>,
    /// Materialien, die für diese Datei benötigt werden (Multi-Material).
    pub materials: Vec<FileMaterial>,
    /// Anzahl der Materialwechsel für diese Datei (FDM, Multi-Material).
    pub material_changes: u32,
    /// Überschreibt den Profil-Schalter „Druckzeit mit Stückzahl multiplizieren“.
    pub multiply_print_time_with_quantity: Option<bool>,
}

impl CalculationFileInput {
    /// Erzeugt eine Dateieingabe mit einer Stückzahl und Druckzeit.
    ///
    /// Der `id`-Wert wird zufällig als UUID v4 vergeben.
    pub fn new(file_name: impl Into<String>, quantity: u32, print_time_hours: Decimal) -> Self {
        Self {
            id: Uuid::new_v4(),
            file_name: file_name.into(),
            quantity,
            print_time_hours,
            volume_cm3: None,
            dimensions_mm: None,
            weight_g: None,
            materials: Vec::new(),
            material_changes: 0,
            multiply_print_time_with_quantity: None,
        }
    }
}

/// Kalkulationsprofil — die kaufmännischen Parameter einer Kalkulation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculationProfile {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Name des Profils.
    pub name: String,
    /// Fehlerrate in Prozent (Spec 0001, Abschnitt 4.10).
    pub fail_rate_percent: Decimal,
    /// Steuersatz in Prozent.
    pub tax_rate_percent: Decimal,
    /// Gewinnmarge in Prozent.
    pub margin_percent: Decimal,
    /// Handlungspauschale in Euro.
    pub handling_fee: Decimal,
    /// Geltungsbereich der Handlungspauschale.
    pub handling_fee_scope: HandlingFeeScope,
    /// Energiepreis in Euro je kWh.
    pub energy_price_per_kwh: Decimal,
    /// Energiekosten anwenden.
    pub apply_energy_costs: bool,
    /// Leistungsgrad in Prozent — Anteil der Bemessungsleistung, der real
    /// abgerufen wird (Referenz: `PowerLevel`).
    pub power_level_percent: Decimal,
    /// Mehrere Materialien einer Datei zu **einer** Position zusammenfassen.
    pub combine_materials: bool,
    /// Druckzeit mit Stückzahl multiplizieren.
    ///
    /// Voreinstellung `true` — wie in der Referenz: die Druckzeit gilt je
    /// Stück und wird für die Stückzahl der Datei verrechnet.
    pub multiply_print_time_with_quantity: bool,
    /// Faktor, mit dem die Druckzeit bei Multiplikation verrechnet wird.
    pub print_time_factor: Decimal,
    /// Maschinenkosten von der Margenberechnung ausnehmen.
    pub exclude_machine_from_margin: bool,
    /// Materialkosten von der Margenberechnung ausnehmen.
    pub exclude_material_from_margin: bool,
    /// Arbeitsschrittkosten von der Margenberechnung ausnehmen.
    pub exclude_worksteps_from_margin: bool,
}

impl Default for CalculationProfile {
    /// Standardprofil ohne Fehlerrate, Marge und Steuer.
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            name: "Standard".to_string(),
            fail_rate_percent: Decimal::ZERO,
            tax_rate_percent: Decimal::ZERO,
            margin_percent: Decimal::ZERO,
            handling_fee: Decimal::ZERO,
            handling_fee_scope: HandlingFeeScope::Once,
            energy_price_per_kwh: Decimal::ZERO,
            apply_energy_costs: false,
            power_level_percent: Decimal::from(100),
            combine_materials: false,
            multiply_print_time_with_quantity: true,
            print_time_factor: Decimal::ONE,
            exclude_machine_from_margin: false,
            exclude_material_from_margin: false,
            exclude_worksteps_from_margin: false,
        }
    }
}

impl CalculationProfile {
    /// Erzeugt ein Standardprofil mit zufälliger UUID v4.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            ..Default::default()
        }
    }
}

/// Die vollständige Eingabe einer Kalkulation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculationInput {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Projektname der Kalkulation.
    pub project_name: String,
    /// Freie Notizen.
    pub notes: Option<String>,
    /// Erstellungszeitpunkt als ISO-8601-String — wird vom Aufrufer geliefert,
    /// damit der Rechenkern keine Uhr liest (Spec 0003, Akzeptanzkriterium 8).
    pub created_at: Option<String>,
    /// Verwendeter Drucker (Schnappschuss).
    pub printer: Printer,
    /// Kalkulationsprofil.
    pub profile: CalculationProfile,
    /// Maschinenstundensatz (Schnappschuss) — optional.
    pub hourly_rate: Option<HourlyRate>,
    /// Arbeitsschritte (Schnappschüsse).
    pub worksteps: Vec<Workstep>,
    /// Zusatzartikel.
    pub additional_items: Vec<AdditionalItem>,
    /// Prozentuale Zuschläge.
    pub custom_surcharges: Vec<CustomSurcharge>,
    /// Zu druckende Dateien.
    pub files: Vec<CalculationFileInput>,
}

impl CalculationInput {
    /// Erzeugt eine leere Kalkulation mit Standardprofil.
    ///
    /// Der `id`-Wert wird zufällig als UUID v4 vergeben.
    pub fn new(project_name: impl Into<String>, printer: Printer) -> Self {
        Self {
            id: Uuid::new_v4(),
            project_name: project_name.into(),
            notes: None,
            created_at: None,
            printer,
            profile: CalculationProfile::default(),
            hourly_rate: None,
            worksteps: Vec::new(),
            additional_items: Vec::new(),
            custom_surcharges: Vec::new(),
            files: Vec::new(),
        }
    }
}
