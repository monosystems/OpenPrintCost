//! Energiekosten (Spec 0001, Abschnitt 4.4).
//!
//! ```text
//! verbrauch_kwh   = druckzeit_h × leistung_w / 1000 × (leistungsgrad_pct / 100)
//! energiekosten   = verbrauch_kwh × energiepreis_pro_kwh
//! ```
//!
//! Der **Leistungsgrad** (`power_level_percent`) beschreibt, welcher Anteil
//! der Bemessungsleistung des Druckers real abgerufen wird — der Wert 100 %
//! bedeutet „Drucker läuft dauerhaft auf voller Bemessungsleistung".

use rust_decimal::Decimal;

/// Energieverbrauch in kWh.
pub fn energy_consumption_kwh(
    print_time_hours: Decimal,
    power_watts: Decimal,
    power_level_percent: Decimal,
) -> Decimal {
    print_time_hours * power_watts / Decimal::from(1000)
        * (power_level_percent / Decimal::from(100))
}

/// Energiekosten in Euro.
pub fn energy_costs(
    print_time_hours: Decimal,
    power_watts: Decimal,
    power_level_percent: Decimal,
    energy_price_per_kwh: Decimal,
) -> Decimal {
    energy_consumption_kwh(print_time_hours, power_watts, power_level_percent)
        * energy_price_per_kwh
}
