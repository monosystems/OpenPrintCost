//! Marge, Zuschläge und Steuer (Spec 0001, Abschnitt 4.9).
//!
//! ```text
//! # Reihenfolge innerhalb einer Datei:
//! kosten_basis  = summe(material, maschine, energie, verfahrenszuschläge,
//!                         arbeitsschritte_pro_stück, artikel)
//!                 + pauschale_je_datei
//!                 + custom_zuschläge_prozent(vor_marge)
//! marge         = (kosten_basis − ausgeschlossene_posten) × marge_prozent / 100
//! kosten_nach_marge = kosten_basis + marge
//! custom_nach_marge = prozentsatz × kosten_nach_marge
//! steuer        = (kosten_nach_marge + custom_nach_marge) × steuersatz / 100
//! ```
//!
//! Marge und Steuer sind **eigene Positionen**, nie im Basispreis versteckt.
//! Die Steuer wird auf die Summe inklusive Marge berechnet.

use rust_decimal::Decimal;

/// Gewinnmarge in Euro.
///
/// `marge = (basis − ausgeschlossene_posten) × marge_prozent / 100`.
///
/// Ausgeschlossene Positionen (z. B. Maschinenkosten) bleiben in der
/// Gesamtsumme enthalten, wirken aber **nicht** als Margebasis.
pub fn margin(base: Decimal, excluded: Decimal, margin_percent: Decimal) -> Decimal {
    (base - excluded) * margin_percent / Decimal::from(100)
}

/// Prozentualer Zuschlag in Euro.
pub fn percentage_surcharge(base: Decimal, percent: Decimal) -> Decimal {
    base * percent / Decimal::from(100)
}

/// Steuer in Euro — `steuerbasis × steuersatz / 100`.
pub fn tax(base: Decimal, tax_percent: Decimal) -> Decimal {
    base * tax_percent / Decimal::from(100)
}
