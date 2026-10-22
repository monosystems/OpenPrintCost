//! Übersetzung der Fachfehler in Tauri-Command-Fehler.

use opc_store::StoreError;
use serde::Serialize;

/// Ein Fehler, der über die Tauri-Grenze transportiert wird.
///
/// Die Oberfläche erhält eine lesbare Meldung — kein Panic, kein
///_sqlite-Fehlertext.
#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    /// Fehlermeldung für die Anzeige.
    pub message: String,
}

impl CommandError {
    /// Erzeugt einen Command-Fehler aus einer Meldung.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for CommandError {}

impl From<StoreError> for CommandError {
    fn from(error: StoreError) -> Self {
        Self::new(error.message())
    }
}

impl From<opc_core::CalcError> for CommandError {
    fn from(error: opc_core::CalcError) -> Self {
        Self::new(error.to_string())
    }
}

impl From<opc_io::IoError> for CommandError {
    fn from(error: opc_io::IoError) -> Self {
        Self::new(error.to_string())
    }
}

impl From<opc_export::ExportError> for CommandError {
    fn from(error: opc_export::ExportError) -> Self {
        Self::new(error.to_string())
    }
}

impl From<uuid::Error> for CommandError {
    fn from(error: uuid::Error) -> Self {
        Self::new(format!("Ungültige ID: {error}"))
    }
}

/// Bequemes Ergebnis-Alias für Commands.
pub type CommandResult<T> = Result<T, CommandError>;
