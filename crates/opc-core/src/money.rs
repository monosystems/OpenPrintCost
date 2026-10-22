//! Geld- und Rundungshelfer.
//!
//! Alle Geldbeträge im Rechenkern sind [`rust_decimal::Decimal`]. `f64` wird
//! an keiner Stelle verwendet — auch nicht für physikalische Messwerte —
//! damit Rundungsfehler nicht durch die gesamte Kostenkette wandern.
//!
//! Die kaufmännische Rundung (Spec 0001, Abschnitt 4.9) erfolgt **erst am
//! Ende**: Positionen speichern exakte Werte, gerundet wird nur bei der
//! Anzeige bzw. beim Export.

use rust_decimal::Decimal;
use rust_decimal::prelude::*;
use serde::{Deserialize, Deserializer, Serializer};

/// Anzahl der Nachkommastellen für Geldbeträge (Cent).
pub const MONEY_SCALE: u32 = 2;

/// Anzahl der Nachkommastellen für Mengenangaben (g, cm³, h, Stück).
pub const QUANTITY_SCALE: u32 = 4;

/// Nullwert als `Decimal`.
pub const ZERO: Decimal = Decimal::ZERO;

/// Rundet einen Betrag kaufmännisch auf zwei Nachkommastellen.
///
/// Verwendet `MidpointAwayFromZero` — die kaufmännische Regel „5 wird
/// aufgerundet" — statt des serienmäßigen „round half to even", damit
/// Beträge wie 1,005 € erwartungsgemäß zu 1,01 € werden.
///
/// ```
/// use opc_core::money::round_money;
/// use rust_decimal_macros::dec;
///
/// assert_eq!(round_money(dec!(1.005)), dec!(1.01));
/// assert_eq!(round_money(dec!(12.5)), dec!(12.50));
/// ```
pub fn round_money(value: Decimal) -> Decimal {
    scale_to(value, MONEY_SCALE)
}

/// Rundet eine Mengenangabe auf [`QUANTITY_SCALE`] Nachkommastellen.
///
/// ```
/// use opc_core::money::round_quantity;
/// use rust_decimal_macros::dec;
///
/// assert_eq!(round_quantity(dec!(1.23456789)), dec!(1.2346));
/// ```
pub fn round_quantity(value: Decimal) -> Decimal {
    scale_to(value, QUANTITY_SCALE)
}

/// Rundet auf `scale` Nachkommastellen und stellt die Nachkommastellenzahl
/// exakt ein (`12,5` → `12,50`).
///
/// `rust_decimal::round_dp` verkleinert die Skala nur, wenn sie zu groß ist —
/// ein Wert mit *weniger* Nachkommastellen behält seine Skala. `rescale`
/// gleicht das aus.
fn scale_to(value: Decimal, scale: u32) -> Decimal {
    let mut rounded = value.round_dp_with_strategy(scale, RoundingStrategy::MidpointAwayFromZero);
    rounded.rescale(scale);
    rounded
}

/// Formatiert einen Betrag in deutscher Schreibweise (Dezimalkomma).
///
/// Wird für die Beschriftung der Positionen verwendet, damit die
/// Oberfläche die Beträge unverändert anzeigen kann.
///
/// ```
/// use opc_core::money::format_de;
/// use rust_decimal_macros::dec;
///
/// assert_eq!(format_de(dec!(12.5), 2), "12,50");
/// ```
pub fn format_de(value: Decimal, scale: u32) -> String {
    scale_to(value, scale).to_string().replace('.', ",")
}

/// Prüft, ob eine Menge größer als null ist, und meldet einen Divisionsfehler.
///
/// Wird überall dort verwendet, wo durch eine Größe geteilt wird, damit die
/// Engine niemals in einen Panic läuft, sondern `Err` liefert.
///
/// ```
/// use opc_core::money::checked_divide;
/// use rust_decimal_macros::dec;
///
/// assert!(checked_divide(dec!(10), dec!(0), "package_size").is_err());
/// assert_eq!(checked_divide(dec!(10), dec!(4), "package_size").unwrap(), dec!(2.5));
/// ```
pub fn checked_divide(
    numerator: Decimal,
    denominator: Decimal,
    field: &'static str,
) -> Result<Decimal, crate::calc::CalcError> {
    if denominator.is_zero() {
        return Err(crate::calc::CalcError::DivisionByZero { field });
    }
    numerator
        .checked_div(denominator)
        .ok_or(crate::calc::CalcError::Arithmetic {
            message: format!("Division von {numerator} durch {denominator} nicht darstellbar"),
        })
}

/// `serde`-Hilfsmodul: serialisiert [`Decimal`] als **String**, nie als `f64`.
///
/// Rundungsfehler und Darstellungsprobleme (deutsches Dezimalkomma) treten
/// beim Transport nicht auf; der String ist zudem diff-freundlich für
/// Export/Import (Spec 0001, Abschnitt 11.1).
pub mod decimal_str {
    use super::{Decimal, Deserialize, Deserializer, Serializer};
    use std::str::FromStr;

    /// Serialisiert einen `Decimal` als String.
    pub fn serialize<S>(value: &Decimal, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&value.to_string())
    }

    /// Deserialisiert einen `Decimal` aus einem String.
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Decimal, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = String::deserialize(deserializer)?;
        Decimal::from_str(&raw).map_err(serde::de::Error::custom)
    }
}

/// `serde`-Hilfsmodul für optionale `Decimal`-Werte (siehe [`decimal_str`]).
pub mod decimal_str_option {
    use super::{Decimal, Deserialize, Deserializer, Serializer};

    /// Serialisiert ein optionales `Decimal` als String.
    pub fn serialize<S>(value: &Option<Decimal>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(v) => serializer.serialize_str(&v.to_string()),
            None => serializer.serialize_none(),
        }
    }

    /// Deserialisiert ein optionales `Decimal` aus einem String.
    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<Decimal>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = Option::<String>::deserialize(deserializer)?;
        match raw {
            Some(text) => text
                .parse::<Decimal>()
                .map(Some)
                .map_err(serde::de::Error::custom),
            None => Ok(None),
        }
    }
}
