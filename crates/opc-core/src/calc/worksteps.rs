//! Arbeitsschritte (Spec 0001, Abschnitt 4.5).
//!
//! * `PerHour`:  `preis × dauer_stunden`
//! * `PerPiece`: `preis × menge × stückzahl` (je Datei positioniert)
//! * `PerOrder`: `preis × menge` (einmal je Kalkulation)

use crate::calc::CalcError;
use crate::calc::checked::mul;
use crate::model::workstep::Workstep;
use rust_decimal::Decimal;

/// Kosten eines Arbeitsschritts pro Stunde.
pub fn per_hour(workstep: &Workstep) -> Result<Decimal, CalcError> {
    mul(workstep.price, workstep.duration_hours, "Arbeitsschritt")
}

/// Kosten eines Arbeitsschritts pro Stück für eine Datei.
pub fn per_piece(workstep: &Workstep, file_quantity: u32) -> Result<Decimal, CalcError> {
    let amount = mul(workstep.price, workstep.quantity, "Arbeitsschritt")?;
    mul(amount, Decimal::from(file_quantity), "Arbeitsschritt")
}

/// Kosten eines Arbeitsschritts pro Auftrag.
pub fn per_order(workstep: &Workstep) -> Result<Decimal, CalcError> {
    mul(workstep.price, workstep.quantity, "Arbeitsschritt")
}
