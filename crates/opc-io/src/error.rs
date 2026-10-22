//! Fehler des Datei-Imports.

/// Fehler, die beim Einlesen von Druckdateien auftreten können.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum IoError {
    /// Die Datei ist leer.
    #[error("Die Datei ist leer")]
    Empty,
    /// Das Format wurde nicht erkannt oder wird nicht unterstützt.
    #[error("Unbekanntes oder nicht unterstütztes Format: {message}")]
    Unsupported {
        /// Beschreibung des Problems.
        message: String,
    },
    /// Die Datei ist beschädigt.
    #[error("Die Datei ist beschädigt: {message}")]
    Corrupt {
        /// Beschreibung des Problems.
        message: String,
    },
}

/// Ergebnis eines Datei-Imports.
pub type IoResult<T> = Result<T, IoError>;
