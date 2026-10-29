//! Materialkosten (Spec 0001, Abschnitt 4.2).
//!
//! ```text
//! preis_pro_gramm      = materialpreis / (verpackungsgröße × einheitenfaktor)
//! materialkosten_basis  = material_g_basis × preis_pro_gramm
//! materialkosten_fehler = material_g_fehler × preis_pro_gramm
//! ```
//!
//! mit
//!
//! ```text
//! gewicht_g          = volumen_cm3 × dichte_g_cm3   (oder explizit gesetzt)
//! material_g_basis   = gewicht_g × stückzahl
//! material_g_fehler  = material_g_basis × fehlerrate / 100
//! ```

use crate::model::calculation::FileMaterial;
use crate::model::material::Material;
use rust_decimal::Decimal;

/// Ermittelt das Stückgewicht eines Materials in Gramm.
///
/// Vorrang:
/// 1. explizit gesetztes Gewicht des Materials (`FileMaterial::weight_g`),
/// 2. explizit gesetztes Volumen des Materials (`FileMaterial::volume_cm3`)
///    × Dichte,
/// 3. explizit gesetztes Gewicht der Datei (`CalculationFileInput::weight_g`),
/// 4. aus dem Dateivolumen und der Dichte berechnetes Gewicht.
///
/// Für Multi-Material müssen die Materialien 1 und 2 gesetzt sein; die
/// Engine prüft das vor der Berechnung.
pub fn piece_weight_g(
    file_material: &FileMaterial,
    file_weight_g: Option<Decimal>,
    volume_cm3: Option<Decimal>,
) -> Decimal {
    if let Some(weight) = file_material.weight_g {
        return weight;
    }
    if let Some(volume) = file_material.volume_cm3 {
        return file_material.material.weight_from_volume(volume);
    }
    if let Some(weight) = file_weight_g {
        return weight;
    }
    match volume_cm3 {
        Some(volume) => file_material.material.weight_from_volume(volume),
        None => Decimal::ZERO,
    }
}

/// Materialverbrauch der Stückzahl in Gramm (`material_g_basis`).
pub fn material_g_base(piece_weight_g: Decimal, quantity: u32) -> Decimal {
    piece_weight_g * Decimal::from(quantity)
}

/// Materialverbrauch aus der Fehlerrate in Gramm (`material_g_fehler`).
pub fn material_g_fail(material_g_base: Decimal, fail_rate_percent: Decimal) -> Decimal {
    material_g_base * fail_rate_percent / Decimal::from(100)
}

/// Materialkosten in Euro (`materialkosten_basis`).
pub fn material_costs_base(material_g: Decimal, price_per_gram: Decimal) -> Decimal {
    material_g * price_per_gram
}

/// Materialkosten aus der Fehlerrate in Euro (`materialkosten_fehler`).
pub fn material_costs_fail(material_g_fail: Decimal, price_per_gram: Decimal) -> Decimal {
    material_g_fail * price_per_gram
}

/// Preis pro Gramm des Materials — delegiert an [`Material::price_per_gram`].
pub fn price_per_gram(material: &Material) -> Result<Decimal, crate::calc::CalcError> {
    material.price_per_gram()
}
