//! Prüfung physikalischer Eingabewerte vor der Berechnung.
//!
//! Die Engine lässt bewusst negative **Geldbeträge** zu (z. B. eine negative
//! Marge als Rabatt) und macht sie sichtbar. Physikalische Größen und
//! prozentuale Anteile dürfen dagegen nicht negativ sein; ein negativer
//! Prozentwert oder eine negative Druckzeit ist immer ein Eingabefehler.
//!
//! Die Prüfung liefert denselben `CalcError::InvalidInput`, den auch andere
//! fachliche Fehler verwenden, und wird vor der eigentlichen Berechnung
//! aufgerufen.

use crate::calc::CalcError;
use crate::model::CalculationInput;
use rust_decimal::Decimal;

/// Prüft die physikalischen Eingaben einer Kalkulation.
///
/// Gibt `Err(CalcError::InvalidInput)` für negative Zeiten, Volumen, Gewichte,
/// Dichten, Leistungen und Bauvolumen sowie für Prozentwerte außerhalb von
/// 0–100 zurück. Monetäre Werte bleiben unangetastet.
pub fn validate(input: &CalculationInput) -> Result<(), CalcError> {
    let printer = &input.printer;
    non_negative("power_watts", printer.power_watts)?;
    non_negative("build_width_mm", printer.build_width_mm)?;
    non_negative("build_depth_mm", printer.build_depth_mm)?;
    non_negative("build_height_mm", printer.build_height_mm)?;

    percent("fail_rate_percent", input.profile.fail_rate_percent)?;
    percent("tax_rate_percent", input.profile.tax_rate_percent)?;
    percent("power_level_percent", input.profile.power_level_percent)?;
    non_negative("print_time_factor", input.profile.print_time_factor)?;

    for file in &input.files {
        non_negative("print_time_hours", file.print_time_hours)?;
        optional_non_negative("volume_cm3", file.volume_cm3)?;
        optional_non_negative("weight_g", file.weight_g)?;
        if let Some(dimensions) = file.dimensions_mm {
            for dimension in dimensions {
                non_negative("dimensions_mm", dimension)?;
            }
        }
        for material in &file.materials {
            optional_non_negative("weight_g", material.weight_g)?;
            optional_non_negative("volume_cm3", material.volume_cm3)?;
            non_negative("density_g_cm3", material.material.density_g_cm3)?;
            non_negative("package_size", material.material.package_size)?;
        }
    }

    if let Some(rate) = &input.hourly_rate {
        non_negative("machine_hours", rate.machine_hours)?;
        non_negative("replacement_cost", rate.replacement_cost)?;
        non_negative("service_life_years", rate.service_life_years)?;
        non_negative("interest_rate_percent", rate.interest_rate_percent)?;
        non_negative("maintenance_fixed", rate.maintenance_fixed)?;
        non_negative("rent_fixed", rate.rent_fixed)?;
        non_negative("electricity_fixed", rate.electricity_fixed)?;
        non_negative("additional_fixed", rate.additional_fixed)?;
        non_negative("maintenance_variable", rate.maintenance_variable)?;
        non_negative("electricity_variable", rate.electricity_variable)?;
        non_negative("additional_variable", rate.additional_variable)?;
        if let Some(override_rate) = rate.fixed_rate_override {
            non_negative("fixed_rate_override", override_rate)?;
        }
    }

    Ok(())
}

/// Meldet einen negativen Wert für das genannte Feld.
fn non_negative(field: &'static str, value: Decimal) -> Result<(), CalcError> {
    if value < Decimal::ZERO {
        return Err(CalcError::InvalidInput {
            message: format!("Feld '{field}' darf nicht negativ sein"),
        });
    }
    Ok(())
}

/// Meldet einen optionalen negativen Wert für das genannte Feld.
fn optional_non_negative(field: &'static str, value: Option<Decimal>) -> Result<(), CalcError> {
    match value {
        Some(value) => non_negative(field, value),
        None => Ok(()),
    }
}

/// Meldet einen Prozentwert außerhalb von 0 bis 100.
fn percent(field: &'static str, value: Decimal) -> Result<(), CalcError> {
    if value < Decimal::ZERO || value > Decimal::from(100) {
        return Err(CalcError::InvalidInput {
            message: format!("Feld '{field}' muss zwischen 0 und 100 liegen"),
        });
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::validate;
    use crate::model::{
        CalculationFileInput, CalculationInput, FileMaterial, Material, PrintProcess, Printer,
    };
    use rust_decimal_macros::dec;

    fn input() -> CalculationInput {
        let mut material = Material::new("PLA", "PLA");
        material.price = dec!(25);
        let mut file = CalculationFileInput::new("Teil.stl", 1, dec!(2));
        file.materials.push(FileMaterial::new(material));
        let mut input = CalculationInput::new("Test", Printer::new("P", PrintProcess::Fdm));
        input.files.push(file);
        input
    }

    #[test]
    fn gueltige_eingabe_wird_akzeptiert() {
        assert!(validate(&input()).is_ok());
    }

    #[test]
    fn negative_druckzeit_wird_abgelehnt() {
        let mut input = input();
        input.files[0].print_time_hours = dec!(-1);
        assert!(validate(&input).is_err());
    }

    #[test]
    fn prozentwert_ueber_hundert_wird_abgelehnt() {
        let mut input = input();
        input.profile.fail_rate_percent = dec!(101);
        assert!(validate(&input).is_err());
    }

    #[test]
    fn negative_leistung_wird_abgelehnt() {
        let mut input = input();
        input.printer.power_watts = dec!(-10);
        assert!(validate(&input).is_err());
    }

    #[test]
    fn negative_marge_bleibt_erlaubt() {
        // Die Engine macht negative Margen bewusst als Rabatt sichtbar.
        let mut input = input();
        input.profile.margin_percent = dec!(-10);
        assert!(validate(&input).is_ok());
    }
}
