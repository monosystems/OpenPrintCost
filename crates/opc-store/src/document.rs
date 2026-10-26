//! Austauschformat für Kalkulationen.
//!
//! Eine exportierte Kalkulationsdatei ist ein versioniertes JSON-Dokument:
//! Es trägt Formatkennung, Version und den vollständigen
//! [`CalculationInput`]-Schnappschuss. Die Formatkennung verhindert, dass
//! beliebiges JSON als Kalkulation eingelesen wird; die Version erlaubt
//! spätere Migrationen, ohne alte Dateien stillschweigend falsch zu deuten.

use crate::error::{StoreError, StoreResult};
use opc_core::model::CalculationInput;
use serde::{Deserialize, Serialize};

/// Formatkennung jeder exportierten Kalkulationsdatei.
pub const CALCULATION_DOCUMENT_FORMAT: &str = "openprintcost.calculation";

/// Aktuelle Version des Austauschformats.
pub const CALCULATION_DOCUMENT_VERSION: u32 = 1;

/// Das versionierte JSON-Dokument einer Kalkulation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CalculationDocument {
    /// Formatkennung — muss [`CALCULATION_DOCUMENT_FORMAT`] entsprechen.
    pub format: String,
    /// Version des Austauschformats.
    pub version: u32,
    /// Der vollständige Kalkulations-Schnappschuss.
    pub calculation: CalculationInput,
}

impl CalculationDocument {
    /// Verpackt eine Kalkulation in das aktuelle Dokumentformat.
    pub fn new(calculation: &CalculationInput) -> Self {
        Self {
            format: CALCULATION_DOCUMENT_FORMAT.to_string(),
            version: CALCULATION_DOCUMENT_VERSION,
            calculation: calculation.clone(),
        }
    }
}

/// Serialisiert eine Kalkulation als hübsch formatiertes JSON-Dokument.
pub fn to_json(calculation: &CalculationInput) -> StoreResult<String> {
    serde_json::to_string_pretty(&CalculationDocument::new(calculation)).map_err(|error| {
        StoreError::InvalidDocument {
            message: format!("Kalkulation konnte nicht serialisiert werden: {error}"),
        }
    })
}

/// Liest und validiert eine Kalkulationsdatei.
///
/// Gibt die enthaltene Kalkulation zurück. Unbekannte Formate und neuere
/// Versionen werden abgelehnt, statt sie falsch zu interpretieren.
pub fn from_json(json: &str) -> StoreResult<CalculationInput> {
    let document: CalculationDocument =
        serde_json::from_str(json).map_err(|error| StoreError::InvalidDocument {
            message: error.to_string(),
        })?;

    if document.format != CALCULATION_DOCUMENT_FORMAT {
        return Err(StoreError::UnsupportedDocument {
            found: document.format,
            expected: CALCULATION_DOCUMENT_FORMAT.to_string(),
        });
    }
    if document.version != CALCULATION_DOCUMENT_VERSION {
        return Err(StoreError::UnsupportedDocumentVersion {
            found: document.version,
            supported: CALCULATION_DOCUMENT_VERSION,
        });
    }

    Ok(document.calculation)
}
