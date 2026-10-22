//! Fehler des Exports.

/// Fehler, die beim Erzeugen von Exportdateien auftreten können.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ExportError {
    /// Die Eingabe enthält keine darstellbaren Daten.
    #[error("Das Ergebnis enthält keine Positionen")]
    Empty,
    /// Die PDF-Erzeugung ist fehlgeschlagen.
    #[error("PDF-Fehler: {message}")]
    Pdf {
        /// Fehlerbeschreibung.
        message: String,
    },
    /// Die Excel-Erzeugung ist fehlgeschlagen.
    #[error("Excel-Fehler: {message}")]
    Excel {
        /// Fehlerbeschreibung.
        message: String,
    },
}

/// Ergebnis einer Export-Erzeugung.
pub type ExportResult<T> = Result<T, ExportError>;
