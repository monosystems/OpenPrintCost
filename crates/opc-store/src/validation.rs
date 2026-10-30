//! Gemeinsame Validierung für alle Speicheradapter.

use crate::error::{StoreError, StoreResult};
use opc_core::model::CalculationInput;

/// Stellt sicher, dass eine Kalkulation keine doppelten Datei-IDs enthält.
pub(crate) fn ensure_unique_file_ids(calculation: &CalculationInput) -> StoreResult<()> {
    let mut seen = std::collections::HashSet::with_capacity(calculation.files.len());
    for file in &calculation.files {
        if !seen.insert(file.id) {
            return Err(StoreError::InvalidValue {
                message: format!("Doppelte Datei-ID '{}' in der Kalkulation", file.id),
            });
        }
    }
    Ok(())
}
