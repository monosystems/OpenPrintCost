//! Geprüfte Arithmetik für den Rechenkern.
//!
//! [`rust_decimal::Decimal`] implementiert die üblichen Operatoren mit Panic
//! bei Überlauf. Der Rechenkern darf bei fehlerhaften oder extremen Eingaben
//! aber niemals paniken. Dieses Modul bündelt die geprüften Varianten und
//! übersetzt einen Überlauf in [`CalcError::Arithmetic`].

use crate::calc::CalcError;
use rust_decimal::Decimal;

/// Addiert zwei Werte und meldet einen Überlauf als Fehler.
pub(crate) fn add(a: Decimal, b: Decimal, context: &'static str) -> Result<Decimal, CalcError> {
    a.checked_add(b).ok_or_else(|| overflow(context))
}

/// Subtrahiert zwei Werte und meldet einen Überlauf als Fehler.
pub(crate) fn sub(a: Decimal, b: Decimal, context: &'static str) -> Result<Decimal, CalcError> {
    a.checked_sub(b).ok_or_else(|| overflow(context))
}

/// Multipliziert zwei Werte und meldet einen Überlauf als Fehler.
pub(crate) fn mul(a: Decimal, b: Decimal, context: &'static str) -> Result<Decimal, CalcError> {
    a.checked_mul(b).ok_or_else(|| overflow(context))
}

/// Dividiert zwei Werte und meldet Division durch null oder Überlauf.
pub(crate) fn div(a: Decimal, b: Decimal, context: &'static str) -> Result<Decimal, CalcError> {
    a.checked_div(b).ok_or_else(|| overflow(context))
}

/// Summiert eine Folge geprüft und meldet einen Überlauf als Fehler.
pub(crate) fn sum<I>(values: I, context: &'static str) -> Result<Decimal, CalcError>
where
    I: IntoIterator<Item = Decimal>,
{
    let mut total = Decimal::ZERO;
    for value in values {
        total = add(total, value, context)?;
    }
    Ok(total)
}

/// Einheitlicher Fehler für nicht darstellbare Ergebnisse.
fn overflow(context: &'static str) -> CalcError {
    CalcError::Arithmetic {
        message: format!("Zahlenbereich überschritten bei {context}"),
    }
}
