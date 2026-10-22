//! Drucker-Stammdaten.

use crate::model::material::MaterialFamily;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

/// Druckverfahren eines Druckers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PrintProcess {
    /// FDM — schmelzschichtdruck (Filament).
    Fdm,
    /// SLA/DLP — Harzdruck (Resin).
    Sla,
    /// Pulverbettdruck (Pulver).
    PowderBed,
}

impl PrintProcess {
    /// Kurzname des Verfahrens für die Anzeige.
    pub fn label(self) -> &'static str {
        match self {
            PrintProcess::Fdm => "FDM",
            PrintProcess::Sla => "SLA",
            PrintProcess::PowderBed => "Pulverbett",
        }
    }
}

/// Ein Drucker mit den für die Kostenrechnung relevanten Stammdaten.
///
/// Die Felder `nozzle_wear_cost`, `build_plate_wear_cost` und
/// `material_change_cost` bilden die verfahrensspezifischen Zuschläge ab
/// (Spec 0001, Abschnitt 4.7). Sie sind optional: fehlen sie, entfällt der
/// jeweilige Zuschlag.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Printer {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Modellbezeichnung, z. B. „Prusa MK4S“.
    pub model: String,
    /// Hersteller des Druckers.
    pub manufacturer: Option<String>,
    /// Druckverfahren.
    pub process: PrintProcess,
    /// Materialart, die der Drucker verarbeitet.
    pub material_family: MaterialFamily,
    /// Maximale Leistungsaufnahme in Watt (Bemessungsleistung).
    pub power_watts: Decimal,
    /// Bauvolumen in mm³.
    pub build_volume_mm3: Decimal,
    /// Kaufpreis des Druckers in Euro.
    pub purchase_price: Decimal,
    /// Maschinenstundensatz in €/h als direkte Referenz.
    ///
    /// Hat Vorrang vor einem zugeordneten [`crate::model::HourlyRate`],
    /// wenn dort kein freier Stundensatz hinterlegt ist.
    pub hourly_rate: Option<Decimal>,
    /// Kosten für den Austausch einer Düse in Euro (FDM).
    pub nozzle_wear_cost: Option<Decimal>,
    /// Kosten für den Austausch einer Druckplatte in Euro (FDM).
    pub build_plate_wear_cost: Option<Decimal>,
    /// Kosten für einen Materialwechsel in Euro (FDM, Multi-Material).
    pub material_change_cost: Option<Decimal>,
    /// Frei definierbare eigene Eigenschaften (Hersteller-Angaben).
    #[serde(default)]
    pub properties: BTreeMap<String, String>,
}

impl Printer {
    /// Erzeugt einen Drucker mit den Standardwerten (keine Verschleißkosten).
    ///
    /// Der `id`-Wert wird zufällig als UUID v4 vergeben.
    pub fn new(model: impl Into<String>, process: PrintProcess) -> Self {
        Self {
            id: Uuid::new_v4(),
            model: model.into(),
            manufacturer: None,
            process,
            material_family: MaterialFamily::Filament,
            power_watts: Decimal::ZERO,
            build_volume_mm3: Decimal::ZERO,
            purchase_price: Decimal::ZERO,
            hourly_rate: None,
            nozzle_wear_cost: None,
            build_plate_wear_cost: None,
            material_change_cost: None,
            properties: BTreeMap::new(),
        }
    }

    /// Liefert den konfigurierten Maschinenstundensatz in €/h, falls vorhanden.
    pub fn hourly_rate_value(&self) -> Option<Decimal> {
        self.hourly_rate.filter(|rate| *rate > Decimal::ZERO)
    }
}
