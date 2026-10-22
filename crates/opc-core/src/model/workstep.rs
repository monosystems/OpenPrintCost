//! Arbeitsschritte — wiederkehrende Tätigkeiten rund um den Druck.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Berechnungstyp eines Arbeitsschritts (Spec 0001, Abschnitt 4.5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorkstepCalculationType {
    /// Kosten je Stunde — `preis × dauer_stunden`.
    PerHour,
    /// Kosten je Stück — `preis × menge × stückzahl` (je Datei positioniert).
    PerPiece,
    /// Pauschalpreis je Auftrag — `preis × menge` (einmal je Kalkulation).
    PerOrder,
}

impl WorkstepCalculationType {
    /// Kurzname für die Anzeige.
    pub fn label(self) -> &'static str {
        match self {
            WorkstepCalculationType::PerHour => "pro Stunde",
            WorkstepCalculationType::PerPiece => "pro Stück",
            WorkstepCalculationType::PerOrder => "pro Auftrag",
        }
    }
}

/// Zeitliche Zuordnung eines Arbeitsschritts zum Druckauftrag.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WorkstepTiming {
    /// Vor dem Druck (z. B. Vorbereitung, Reinigung).
    Before,
    /// Nach dem Druck (z. B. Entnahme, Nachbearbeitung).
    After,
    /// Sonstiges / nicht zeitlich gebunden.
    Other,
}

/// Kategorie eines Arbeitsschritts (eigene Stammdatentabelle).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct WorkstepCategory {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Name der Kategorie, z. B. „Nachbearbeitung“.
    pub name: String,
    /// Optionale Farbangabe für die Oberfläche.
    pub color: Option<String>,
}

impl WorkstepCategory {
    /// Erzeugt eine Kategorie mit zufälliger UUID v4.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            color: None,
        }
    }
}

/// Ein Arbeitsschritt, der in eine Kalkulation eingerechnet wird.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Workstep {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Name des Arbeitsschritts, z. B. „Entnahme und Entstutzung“.
    pub name: String,
    /// Kategorie des Arbeitsschritts.
    pub category: WorkstepCategory,
    /// Berechnungstyp.
    pub calculation_type: WorkstepCalculationType,
    /// Preis in Euro — je Stunde, je Stück oder je Auftrag, je nach Typ.
    pub price: Decimal,
    /// Menge — Multiplikator bei `PerPiece` und `PerOrder`.
    pub quantity: Decimal,
    /// Dauer in Stunden — nur bei `PerHour` relevant.
    pub duration_hours: Decimal,
    /// Zeitliche Zuordnung.
    pub timing: WorkstepTiming,
}

impl Workstep {
    /// Erzeugt einen Arbeitsschritt mit Standardwerten (Menge 1, Dauer 0).
    ///
    /// Der `id`-Wert wird zufällig als UUID v4 vergeben.
    pub fn new(
        name: impl Into<String>,
        category: WorkstepCategory,
        calculation_type: WorkstepCalculationType,
        price: Decimal,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            category,
            calculation_type,
            price,
            quantity: Decimal::ONE,
            duration_hours: Decimal::ZERO,
            timing: WorkstepTiming::Other,
        }
    }
}
