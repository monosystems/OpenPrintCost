//! Rechenkern — die fachlichen Kostenformeln.
//!
//! Jede Formel ist in einem eigenen Modul gekapselt und dort dokumentiert.
//! Das Modul [`engine`] orchestriert die Aufrufe in der **fixen Reihenfolge**
//! der Kostenblöcke (Spec 0001, Abschnitt 4).

pub mod energy;
pub mod engine;
pub mod machine_hour_rate;
pub mod margin;
pub mod material;
pub mod worksteps;

pub use engine::calculate;

/// Fehler der Kostenberechnung.
///
/// Die Engine liefert `Err` statt in einen Panic zu laufen — insbesondere
/// bei Division durch null (Spec 0003, Akzeptanzkriterium 10 und 11).
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum CalcError {
    /// Division durch null in dem genannten Feld.
    #[error("Division durch null im Feld '{field}'")]
    DivisionByZero {
        /// Name des Feldes, dessen Wert null war.
        field: &'static str,
    },
    /// Eingabe ist fachlich ungültig.
    #[error("Ungültige Eingabe: {message}")]
    InvalidInput {
        /// Beschreibung des Problems.
        message: String,
    },
    /// Arithmetische Grenze überschritten (z. B. Überlauf der `Decimal`-Mantisse).
    #[error("Arithmetischer Fehler: {message}")]
    Arithmetic {
        /// Beschreibung des Problems.
        message: String,
    },
}
