//! Arbeitsschritte (Spec 0001, Abschnitt 4.5).
//!
//! ```text
//! pro_stunde:   kosten = stundensatz × dauer_stunden
//! pro_stück:    kosten = stückpreis × menge × stückzahl_der_datei
//! pro_auftrag:  kosten = pauschalpreis × menge           (einmal je Kalkulation)
//! ```
//!
//! Arbeitsschritte vom Typ *pro Stück* werden je Datei positioniert, die
//! übrigen auf Projektebene.

use crate::model::workstep::{Workstep, WorkstepCalculationType};
use rust_decimal::Decimal;

/// Kosten eines Arbeitsschritts vom Typ *pro Stunde*.
pub fn per_hour(workstep: &Workstep) -> Decimal {
    workstep.price * workstep.duration_hours
}

/// Kosten eines Arbeitsschritts vom Typ *pro Stück* für eine Datei.
pub fn per_piece(workstep: &Workstep, file_quantity: u32) -> Decimal {
    workstep.price * workstep.quantity * Decimal::from(file_quantity)
}

/// Kosten eines Arbeitsschritts vom Typ *pro Auftrag* — einmal je Kalkulation.
pub fn per_order(workstep: &Workstep) -> Decimal {
    workstep.price * workstep.quantity
}

/// Dispatcher: rechnet die Kosten eines Arbeitsschritts in Abhängigkeit vom
/// Berechnungstyp.
///
/// Bei *pro Stück* wird die Stückzahl der Datei benötigt, bei *pro Stunde* die
/// Dauer und bei *pro Auftrag* nur die Menge.
pub fn costs(workstep: &Workstep, file_quantity: u32) -> Decimal {
    match workstep.calculation_type {
        WorkstepCalculationType::PerHour => per_hour(workstep),
        WorkstepCalculationType::PerPiece => per_piece(workstep, file_quantity),
        WorkstepCalculationType::PerOrder => per_order(workstep),
    }
}
