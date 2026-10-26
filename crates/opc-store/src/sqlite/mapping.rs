//! Übersetzung zwischen SQLite-Zeilen und Domänenobjekten.
//!
//! Diese Schicht ist **adapterintern**: sie kennt die Spaltennamen und ist
//! damit bewusst kein Teil des Ports (Spec 0005, Akzeptanzkriterium 3).

use crate::error::{StoreError, StoreResult};
use chrono::{SecondsFormat, Utc};
use opc_core::model::{
    CalculationProfile, HandlingFeeScope, HourlyRate, Material, MaterialFamily, PrintProcess,
    Printer, TimeBasis, Workstep, WorkstepCalculationType, WorkstepCategory, WorkstepTiming,
};
use rusqlite::Row;
use rusqlite::types::Type;
use rust_decimal::Decimal;
use serde::Serialize;
use serde::de::DeserializeOwned;
use std::collections::BTreeMap;

/// Aktueller Zeitpunkt als ISO-8601-String mit UTC.
pub(crate) fn now_iso8601() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// `Decimal` → Text (exakt, ohne Rundung).
pub(crate) fn decimal_to_text(value: Decimal) -> String {
    value.to_string()
}

/// Text → `Decimal`.
pub(crate) fn decimal_from_text(text: &str) -> rusqlite::Result<Decimal> {
    text.parse::<Decimal>().map_err(|error| {
        sql_error(StoreError::Corrupt {
            message: format!("'{text}' ist keine gültige Zahl: {error}"),
        })
    })
}

/// Optionaler Text → optionale `Decimal`.
pub(crate) fn optional_decimal_from_text(
    value: Option<String>,
) -> rusqlite::Result<Option<Decimal>> {
    match value {
        Some(text) => Ok(Some(decimal_from_text(&text)?)),
        None => Ok(None),
    }
}

/// Enum → Text (über die `serde`-Darstellung, damit die Zuordnung nicht
/// auseinanderlaufen kann).
pub(crate) fn enum_to_text<T: Serialize>(value: &T) -> StoreResult<String> {
    serde_json::to_value(value)
        .ok()
        .and_then(|value| value.as_str().map(str::to_string))
        .ok_or_else(|| StoreError::Corrupt {
            message: "Wert konnte nicht serialisiert werden".to_string(),
        })
}

/// Text → Enum.
pub(crate) fn enum_from_text<T: DeserializeOwned>(text: &str) -> rusqlite::Result<T> {
    serde_json::from_value(serde_json::Value::String(text.to_string())).map_err(|error| {
        sql_error(StoreError::Corrupt {
            message: format!("'{text}' ist kein gültiger Wert: {error}"),
        })
    })
}

/// Freie Eigenschaften → JSON-Text.
pub(crate) fn properties_to_text(properties: &BTreeMap<String, String>) -> String {
    serde_json::to_string(properties).unwrap_or_else(|_| "{}".to_string())
}

/// JSON-Text → freie Eigenschaften.
pub(crate) fn properties_from_text(text: &str) -> rusqlite::Result<BTreeMap<String, String>> {
    serde_json::from_str(text).map_err(|error| {
        sql_error(StoreError::Corrupt {
            message: format!("Eigenschaften sind unlesbar: {error}"),
        })
    })
}

/// Boolean → SQLite-Integer.
pub(crate) fn bool_to_int(value: bool) -> i64 {
    i64::from(value)
}

/// SQLite-Integer → Boolean.
pub(crate) fn int_to_bool(value: i64) -> bool {
    value != 0
}

/// Liest eine Pflichtspalte als String.
fn column(row: &Row, index: usize) -> rusqlite::Result<String> {
    row.get::<_, String>(index).map_err(|error| {
        sql_error(StoreError::Corrupt {
            message: format!("Spalte {index} ist unlesbar: {error}"),
        })
    })
}

/// Liest eine Boolean-Spalte (0/1).
fn bool_column(row: &Row, index: usize) -> rusqlite::Result<bool> {
    let value = row.get::<_, i64>(index).map_err(|error| {
        sql_error(StoreError::Corrupt {
            message: format!("Spalte {index} ist unlesbar: {error}"),
        })
    })?;
    Ok(int_to_bool(value))
}

/// Liest eine optionale Spalte als String.
fn optional_column(row: &Row, index: usize) -> rusqlite::Result<Option<String>> {
    row.get::<_, Option<String>>(index).map_err(|error| {
        sql_error(StoreError::Corrupt {
            message: format!("Spalte {index} ist unlesbar: {error}"),
        })
    })
}

/// Baut einen Drucker aus einer Zeile.
pub(crate) fn row_to_printer(row: &Row) -> rusqlite::Result<Printer> {
    let id = column(row, 0)?;
    let model = column(row, 1)?;
    let manufacturer = optional_column(row, 2)?;
    let process = enum_from_text::<PrintProcess>(&column(row, 3)?)?;
    let material_family = enum_from_text::<MaterialFamily>(&column(row, 4)?)?;
    let power_watts = decimal_from_text(&column(row, 5)?)?;
    let build_width_mm = decimal_from_text(&column(row, 6)?)?;
    let build_depth_mm = decimal_from_text(&column(row, 7)?)?;
    let build_height_mm = decimal_from_text(&column(row, 8)?)?;
    let purchase_price = decimal_from_text(&column(row, 9)?)?;
    let hourly_rate = optional_decimal_from_text(optional_column(row, 10)?)?;
    let nozzle_wear_cost = optional_decimal_from_text(optional_column(row, 11)?)?;
    let build_plate_wear_cost = optional_decimal_from_text(optional_column(row, 12)?)?;
    let material_change_cost = optional_decimal_from_text(optional_column(row, 13)?)?;
    let properties = properties_from_text(&column(row, 14)?)?;

    Ok(Printer {
        id: parse_uuid(&id)?,
        model,
        manufacturer,
        process,
        material_family,
        power_watts,
        build_width_mm,
        build_depth_mm,
        build_height_mm,
        purchase_price,
        hourly_rate,
        nozzle_wear_cost,
        build_plate_wear_cost,
        material_change_cost,
        properties,
    })
}

/// Baut ein Material aus einer Zeile.
pub(crate) fn row_to_material(row: &Row) -> rusqlite::Result<Material> {
    let id = column(row, 0)?;
    let name = column(row, 1)?;
    let material_type = column(row, 2)?;
    let family = enum_from_text::<MaterialFamily>(&column(row, 3)?)?;
    let manufacturer = optional_column(row, 4)?;
    let shop_link = optional_column(row, 5)?;
    let density_g_cm3 = decimal_from_text(&column(row, 6)?)?;
    let package_size = decimal_from_text(&column(row, 7)?)?;
    let unit = enum_from_text::<opc_core::units::MaterialUnit>(&column(row, 8)?)?;
    let price = decimal_from_text(&column(row, 9)?)?;
    let properties = properties_from_text(&column(row, 10)?)?;

    Ok(Material {
        id: parse_uuid(&id)?,
        name,
        material_type,
        family,
        manufacturer,
        shop_link,
        density_g_cm3,
        package_size,
        unit,
        price,
        properties,
    })
}

/// Baut eine Arbeitsschritt-Kategorie aus einer Zeile.
pub(crate) fn row_to_category(row: &Row) -> rusqlite::Result<WorkstepCategory> {
    let id = column(row, 0)?;
    let name = column(row, 1)?;
    let color = optional_column(row, 2)?;

    Ok(WorkstepCategory {
        id: parse_uuid(&id)?,
        name,
        color,
    })
}

/// Baut einen Arbeitsschritt aus einer Zeile.
pub(crate) fn row_to_workstep(row: &Row) -> rusqlite::Result<Workstep> {
    let id = column(row, 0)?;
    let name = column(row, 1)?;
    let category_id = column(row, 2)?;
    let category_name = column(row, 3)?;
    let calculation_type = enum_from_text::<WorkstepCalculationType>(&column(row, 4)?)?;
    let price = decimal_from_text(&column(row, 5)?)?;
    let quantity = decimal_from_text(&column(row, 6)?)?;
    let duration_hours = decimal_from_text(&column(row, 7)?)?;
    let timing = enum_from_text::<WorkstepTiming>(&column(row, 8)?)?;

    Ok(Workstep {
        id: parse_uuid(&id)?,
        name,
        category: WorkstepCategory {
            id: parse_uuid(&category_id)?,
            name: category_name,
            color: None,
        },
        calculation_type,
        price,
        quantity,
        duration_hours,
        timing,
    })
}

/// Baut einen Maschinenstundensatz aus einer Zeile.
pub(crate) fn row_to_hourly_rate(row: &Row) -> rusqlite::Result<HourlyRate> {
    let id = column(row, 0)?;
    let name = column(row, 1)?;
    let time_basis = enum_from_text::<TimeBasis>(&column(row, 2)?)?;

    Ok(HourlyRate {
        id: parse_uuid(&id)?,
        name,
        time_basis,
        machine_hours: decimal_from_text(&column(row, 3)?)?,
        replacement_cost: decimal_from_text(&column(row, 4)?)?,
        service_life_years: decimal_from_text(&column(row, 5)?)?,
        interest_rate_percent: decimal_from_text(&column(row, 6)?)?,
        maintenance_fixed: decimal_from_text(&column(row, 7)?)?,
        rent_fixed: decimal_from_text(&column(row, 8)?)?,
        electricity_fixed: decimal_from_text(&column(row, 9)?)?,
        additional_fixed: decimal_from_text(&column(row, 10)?)?,
        maintenance_variable: decimal_from_text(&column(row, 11)?)?,
        electricity_variable: decimal_from_text(&column(row, 12)?)?,
        additional_variable: decimal_from_text(&column(row, 13)?)?,
        fixed_rate_override: optional_decimal_from_text(optional_column(row, 14)?)?,
    })
}

/// Baut ein Kalkulationsprofil aus einer Zeile.
pub(crate) fn row_to_profile(row: &Row) -> rusqlite::Result<CalculationProfile> {
    let id = column(row, 0)?;
    let name = column(row, 1)?;

    Ok(CalculationProfile {
        id: parse_uuid(&id)?,
        name,
        fail_rate_percent: decimal_from_text(&column(row, 2)?)?,
        tax_rate_percent: decimal_from_text(&column(row, 3)?)?,
        margin_percent: decimal_from_text(&column(row, 4)?)?,
        handling_fee: decimal_from_text(&column(row, 5)?)?,
        handling_fee_scope: enum_from_text::<HandlingFeeScope>(&column(row, 6)?)?,
        energy_price_per_kwh: decimal_from_text(&column(row, 7)?)?,
        apply_energy_costs: bool_column(row, 8)?,
        power_level_percent: decimal_from_text(&column(row, 9)?)?,
        combine_materials: bool_column(row, 10)?,
        multiply_print_time_with_quantity: bool_column(row, 11)?,
        print_time_factor: decimal_from_text(&column(row, 12)?)?,
        exclude_machine_from_margin: bool_column(row, 13)?,
        exclude_material_from_margin: bool_column(row, 14)?,
        exclude_worksteps_from_margin: bool_column(row, 15)?,
    })
}

/// Parst eine UUID aus ihrem Text — bei ungültiger ID ein klarer Fehler.
pub(crate) fn parse_uuid(text: &str) -> rusqlite::Result<uuid::Uuid> {
    uuid::Uuid::parse_str(text).map_err(|_| {
        sql_error(StoreError::InvalidId {
            value: text.to_string(),
        })
    })
}

/// Wrapper, der einen Port-Fehler durch die rusqlite-Fehlerkane transportiert.
///
/// `rusqlite` verlangt von Zeilenfunktionen `rusqlite::Result`. Damit die
/// aussagekräftigen Port-Fehler (`NotFound`, `Corrupt`, …) trotzdem erhalten
/// bleiben, werden sie verpackt und in [`backend`] wieder ausgepackt.
#[derive(Debug)]
struct RowError(StoreError);

impl std::fmt::Display for RowError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}", self.0)
    }
}

impl std::error::Error for RowError {}

/// Verpackt einen Port-Fehler als rusqlite-Fehler.
fn sql_error(error: StoreError) -> rusqlite::Error {
    rusqlite::Error::FromSqlConversionFailure(0, Type::Text, Box::new(RowError(error)))
}

/// Übersetzt einen rusqlite-Fehler in einen Port-Fehler.
///
/// Verpackte Port-Fehler werden unverändert zurückgegeben; alles andere wird
/// zu [`StoreError::Backend`].
pub(crate) fn backend(error: rusqlite::Error) -> StoreError {
    match error {
        rusqlite::Error::FromSqlConversionFailure(_, _, source) => {
            match source.downcast::<RowError>() {
                Ok(row_error) => row_error.0.clone(),
                Err(source) => StoreError::Backend {
                    message: source.to_string(),
                },
            }
        }
        other => StoreError::Backend {
            message: other.to_string(),
        },
    }
}
