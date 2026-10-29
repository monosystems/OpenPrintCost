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

/// Firmendaten für Reportköpfe und Einstellungen.
///
/// Genau ein Datensatz (Singleton) — der Adapter liefert leere Firmendaten,
/// wenn noch nichts gespeichert wurde (Spec 0012).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompanyInfo {
    /// Firmenname.
    pub name: String,
    /// Straße und Hausnummer.
    pub street: String,
    /// PLZ und Ort.
    pub zip_city: String,
    /// E-Mail-Adresse.
    pub email: String,
    /// Währungscode (ISO 4217, z. B. "USD") — reines Anzeige-Symbol,
    /// keine Umrechnung. Alle Beträge bleiben in dieser einen Währung.
    #[serde(default = "default_currency")]
    pub currency: String,
}

/// Standardwährung für **neue** Datenbanken und neue Firmendatensätze.
///
/// Bestehende Datenbanken aus der Zeit vor Migration 0004 erhalten bewusst
/// `EUR` (damals wurden alle Beträge in Euro geführt); dieser Wert wird beim
/// Laden aus der Datenbank übernommen und nicht überschrieben.
pub fn default_currency() -> String {
    "USD".to_string()
}

impl Default for CompanyInfo {
    fn default() -> Self {
        Self {
            name: String::new(),
            street: String::new(),
            zip_city: String::new(),
            email: String::new(),
            currency: default_currency(),
        }
    }
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
