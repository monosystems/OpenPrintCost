//! Marge und Steuer (Spec 0001, Abschnitt 4.9).
//!
//! ```text
//! kosten_basis  = material + maschine + energie + verfahren
//!                 + arbeitsschritte + zusatzartikel
//!                 + pauschale_je_datei
//!                 + custom_zuschläge_prozent(vor_marge)
//! marge         = (kosten_basis − ausgeschlossene_posten) × marge_prozent / 100
//! kosten_nach_marge = kosten_basis + marge
//! steuer        = (kosten_nach_marge + custom_nach_marge) × steuersatz / 100
//! ```
//!
//! Negative Margen sind zulässig und bleiben als Rabatt sichtbar.

use crate::calc::CalcError;
use crate::calc::checked::{div, mul, sub};
use rust_decimal::Decimal;

/// Marge als Betrag — `marge = (basis − ausgeschlossene_posten) × marge_prozent / 100`.
pub fn margin(
    base: Decimal,
    excluded: Decimal,
    margin_percent: Decimal,
) -> Result<Decimal, CalcError> {
    let base = sub(base, excluded, "Margenbasis")?;
    let rate = div(margin_percent, Decimal::from(100), "Marge")?;
    mul(base, rate, "Marge")
}

/// Prozentualer Zuschlag auf eine Basis.
pub fn percentage_surcharge(base: Decimal, percent: Decimal) -> Result<Decimal, CalcError> {
    let rate = div(percent, Decimal::from(100), "Zuschlag")?;
    mul(base, rate, "Zuschlag")
}

/// Steuer in Euro — `steuerbasis × steuersatz / 100`.
pub fn tax(base: Decimal, tax_percent: Decimal) -> Result<Decimal, CalcError> {
    let rate = div(tax_percent, Decimal::from(100), "Steuer")?;
    mul(base, rate, "Steuer")
}
