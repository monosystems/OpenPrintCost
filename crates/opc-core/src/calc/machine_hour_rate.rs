//! Maschinenstundensatz (Spec 0001, Abschnitt 4.6).
//!
//! ```text
//! abschreibung = wiederbeschaffungskosten / nutzungsdauer_jahre
//! zins         = (wiederbeschaffungskosten / 2) / 100 × zinssatz
//!
//! # wenn fester_stundensatz gesetzt (>= 0):  stundensatz = fester_stundensatz
//! # wenn maschinenstunden <= 0:            stundensatz = 0
//! # sonst (zeitbasis pro Jahr: faktor = 1, pro Monat: faktor = 12):
//!
//! stundensatz = ( abschreibung
//!               + zins
//!               + (wartung + miete + strom + zusatzkosten)              × faktor
//!               + (wartung_var + strom_var + zusatzkosten_var)          × faktor
//!               ) / ( maschinenstunden × faktor )
//! ```
//!
//! Abschreibung und Zins sind Jahreswerte und werden **nicht** mit `faktor`
//! multipliziert.

use crate::calc::checked::{add, div, mul};
use crate::model::hourly_rate::{HourlyRate, TimeBasis};
use rust_decimal::Decimal;

/// Berechnet den Maschinenstundensatz in €/h.
///
/// Vorrangregeln:
/// 1. Ein gesetzter freier Stundensatz (`fixed_rate_override`) ab 0 gewinnt.
/// 2. Maschinenstunden von 0 oder weniger ergeben einen Stundensatz von 0.
/// 3. Eine Nutzungsdauer von 0 ergibt eine Abschreibung von 0.
///
/// ```
/// use opc_core::calc::machine_hour_rate::calculate_hourly_rate;
/// use opc_core::model::{HourlyRate, TimeBasis};
/// use rust_decimal_macros::dec;
///
/// let mut rate = HourlyRate::new("Test");
/// rate.time_basis = TimeBasis::PerYear;
/// rate.machine_hours = dec!(800);
/// rate.replacement_cost = dec!(1000);
/// rate.service_life_years = dec!(4);
/// rate.interest_rate_percent = dec!(3);
/// rate.maintenance_fixed = dec!(50);
/// rate.rent_fixed = dec!(20);
/// rate.electricity_fixed = dec!(30);
/// rate.additional_fixed = dec!(10);
/// rate.maintenance_variable = dec!(5);
/// rate.electricity_variable = dec!(10);
///
/// assert_eq!(calculate_hourly_rate(&rate).unwrap(), dec!(0.4875));
/// ```
pub fn calculate_hourly_rate(rate: &HourlyRate) -> Result<Decimal, crate::calc::CalcError> {
    if let Some(override_rate) = rate.fixed_rate_override
        && override_rate >= Decimal::ZERO
    {
        return Ok(override_rate);
    }

    if rate.machine_hours <= Decimal::ZERO {
        return Ok(Decimal::ZERO);
    }

    let factor = Decimal::from(rate.time_basis.year_factor());
    let depreciation = depreciation(rate)?;
    let interest = interest(rate)?;
    let fixed = mul(rate.fixed_costs()?, factor, "Fixkosten")?;
    let variable = mul(rate.variable_costs()?, factor, "Variable Kosten")?;
    let numerator = add(
        add(depreciation, interest, "Maschinenstundensatz")?,
        fixed,
        "Maschinenstundensatz",
    )?;
    let numerator = add(numerator, variable, "Maschinenstundensatz")?;
    let denominator = mul(rate.machine_hours, factor, "Maschinenstunden")?;

    div(numerator, denominator, "Maschinenstundensatz")
}

/// Abschreibung in Euro pro Jahr.
///
/// `wiederbeschaffungskosten / nutzungsdauer_jahre` — bei Nutzungsdauer 0
/// wird 0 zurückgegeben (kein Divisionsfehler).
fn depreciation(rate: &HourlyRate) -> Result<Decimal, crate::calc::CalcError> {
    if rate.service_life_years <= Decimal::ZERO {
        return Ok(Decimal::ZERO);
    }
    div(
        rate.replacement_cost,
        rate.service_life_years,
        "Abschreibung",
    )
}

/// Zinskosten in Euro pro Jahr.
///
/// `(wiederbeschaffungskosten / 2) / 100 × zinssatz` — die Bezugshälfte der
/// Wiederbeschaffungskosten als Kapitalbindung.
fn interest(rate: &HourlyRate) -> Result<Decimal, crate::calc::CalcError> {
    let half = div(rate.replacement_cost, Decimal::from(2), "Zins")?;
    let percent = div(half, Decimal::from(100), "Zins")?;
    mul(percent, rate.interest_rate_percent, "Zins")
}

/// Zeitbasis-Faktor als `Decimal` — 1 pro Jahr, 12 pro Monat.
pub fn time_basis_factor(basis: TimeBasis) -> Decimal {
    Decimal::from(basis.year_factor())
}
