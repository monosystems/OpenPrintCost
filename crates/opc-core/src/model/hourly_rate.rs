//! Maschinenstundensatz — die kalkulatorische Miete des Druckers.

use crate::calc::checked::sum;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Zeitbasis, auf der sich die Maschinenstunden beziehen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TimeBasis {
    /// Maschinenstunden pro Jahr (Faktor 1).
    PerYear,
    /// Maschinenstunden pro Monat (Faktor 12).
    PerMonth,
}

impl TimeBasis {
    /// Umrechnungsfaktor auf die Jahresbasis.
    ///
    /// Abschreibung und Zins sind Jahreswerte und werden **nicht** mit diesem
    /// Faktor multipliziert (Spec 0001, Abschnitt 4.6).
    pub const fn year_factor(self) -> i64 {
        match self {
            TimeBasis::PerYear => 1,
            TimeBasis::PerMonth => 12,
        }
    }
}

/// Ein Maschinenstundensatz mit allen Eingangsgrößen der Berechnung.
///
/// Der Stundensatz wird berechnet als
///
/// ```text
/// abschreibung = wiederbeschaffungskosten / nutzungsdauer_jahre
/// zins         = (wiederbeschaffungskosten / 2) / 100 × zinssatz
/// stundensatz  = (abschreibung + zins + fixkosten × faktor + variable_kosten × faktor)
///                / (maschinenstunden × faktor)
/// ```
///
/// (Spec 0001, Abschnitt 4.6).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HourlyRate {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Name des Stundensatzes, z. B. „Büro-Drucker 2026“.
    pub name: String,
    /// Zeitbasis der Maschinenstunden.
    pub time_basis: TimeBasis,
    /// Maschinenstunden je Zeitbasis.
    pub machine_hours: Decimal,
    /// Wiederbeschaffungskosten des Druckers in Euro.
    pub replacement_cost: Decimal,
    /// Nutzungsdauer in Jahren.
    pub service_life_years: Decimal,
    /// Zinssatz in Prozent.
    pub interest_rate_percent: Decimal,
    /// Fixkosten: Wartung in Euro je Zeitbasis.
    pub maintenance_fixed: Decimal,
    /// Fixkosten: Miete/Raum in Euro je Zeitbasis.
    pub rent_fixed: Decimal,
    /// Fixkosten: Strom in Euro je Zeitbasis.
    pub electricity_fixed: Decimal,
    /// Fixkosten: zusätzliche Kosten in Euro je Zeitbasis.
    pub additional_fixed: Decimal,
    /// Variable Kosten: Wartung in Euro je Stunde.
    pub maintenance_variable: Decimal,
    /// Variable Kosten: Strom in Euro je Stunde.
    pub electricity_variable: Decimal,
    /// Variable Kosten: zusätzliche Kosten in Euro je Stunde.
    pub additional_variable: Decimal,
    /// Frei gesetzter Stundensatz in €/h — überschreibt die Berechnung.
    pub fixed_rate_override: Option<Decimal>,
}

impl HourlyRate {
    /// Erzeugt einen Stundensatz mit Nullwerten.
    ///
    /// Der `id`-Wert wird zufällig als UUID v4 vergeben.
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            time_basis: TimeBasis::PerYear,
            machine_hours: Decimal::ZERO,
            replacement_cost: Decimal::ZERO,
            service_life_years: Decimal::ZERO,
            interest_rate_percent: Decimal::ZERO,
            maintenance_fixed: Decimal::ZERO,
            rent_fixed: Decimal::ZERO,
            electricity_fixed: Decimal::ZERO,
            additional_fixed: Decimal::ZERO,
            maintenance_variable: Decimal::ZERO,
            electricity_variable: Decimal::ZERO,
            additional_variable: Decimal::ZERO,
            fixed_rate_override: None,
        }
    }

    /// Summe der Fixkosten je Zeitbasis in Euro.
    pub fn fixed_costs(&self) -> Result<Decimal, crate::calc::CalcError> {
        sum(
            [
                self.maintenance_fixed,
                self.rent_fixed,
                self.electricity_fixed,
                self.additional_fixed,
            ],
            "Fixkosten",
        )
    }

    /// Summe der variablen Kosten je Stunde in Euro.
    pub fn variable_costs(&self) -> Result<Decimal, crate::calc::CalcError> {
        sum(
            [
                self.maintenance_variable,
                self.electricity_variable,
                self.additional_variable,
            ],
            "Variable Kosten",
        )
    }
}
