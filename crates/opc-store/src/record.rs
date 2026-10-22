//! Persistenz-DTOs — die Formen, in denen der Store Daten zurückgibt.

use opc_core::model::CalculationInput;
use serde::{Deserialize, Serialize};

/// Eine gespeicherte Kalkulation.
///
/// `document` enthält den vollständigen **Schnappschuss** des
/// [`CalculationInput`] zum Zeitpunkt des Speicherns. Damit bleiben
/// historische Kalkulationen unverändert, wenn die Stammdaten später
/// bearbeitet werden (Spec 0001, Abschnitt 2).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StoredCalculation {
    /// ID der Kalkulation.
    pub id: String,
    /// Projektname.
    pub project_name: String,
    /// Erstellungszeitpunkt (ISO-8601).
    pub created_at: String,
    /// Letzter Änderungszeitpunkt (ISO-8601).
    pub updated_at: String,
    /// Der vollständige Schnappschuss.
    pub document: CalculationInput,
}

/// Kurzfassung einer Kalkulation für Listenansichten.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculationSummary {
    /// ID der Kalkulation.
    pub id: String,
    /// Projektname.
    pub project_name: String,
    /// Erstellungszeitpunkt (ISO-8601).
    pub created_at: String,
    /// Letzter Änderungszeitpunkt (ISO-8601).
    pub updated_at: String,
    /// Anzahl der enthaltenen Dateien.
    pub file_count: u32,
    /// Summe der Stückzahlen aller Dateien.
    pub total_quantity: u32,
}
