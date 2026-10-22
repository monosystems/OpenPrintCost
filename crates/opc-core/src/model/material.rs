//! Material-Stammdaten.

use crate::money;
use crate::units::MaterialUnit;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use uuid::Uuid;

/// Materialfamilie — bestimmt, ob ein Drucker das Material verarbeiten kann.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MaterialFamily {
    /// Filament (FFF/FDM).
    Filament,
    /// Harz / Resin (SLA/DLP).
    Resin,
    /// Pulver (Pulverbettdruck).
    Powder,
}

impl MaterialFamily {
    /// Kurzname der Materialfamilie für die Anzeige.
    pub fn label(self) -> &'static str {
        match self {
            MaterialFamily::Filament => "Filament",
            MaterialFamily::Resin => "Harz",
            MaterialFamily::Powder => "Pulver",
        }
    }
}

/// Ein Material mit Preis, Dichte und Verpackungsgröße.
///
/// Der Preis bezieht sich immer auf **eine** Verpackung der Größe
/// `package_size` in der Einheit `unit` (Spec 0001, Abschnitt 3).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Material {
    /// Stabile Identität (UUID v4).
    pub id: Uuid,
    /// Bezeichnung des Materials, z. B. „PETG Schwarz“.
    pub name: String,
    /// Materialtyp, z. B. „PLA“, „PETG“, „ABS“.
    pub material_type: String,
    /// Materialfamilie.
    pub family: MaterialFamily,
    /// Hersteller des Materials.
    pub manufacturer: Option<String>,
    /// Link zum Shopsystem des Herstellers.
    pub shop_link: Option<String>,
    /// Dichte in g/cm³.
    pub density_g_cm3: Decimal,
    /// Verpackungsgröße in der Einheit `unit`, z. B. `1` bei `Kg`.
    pub package_size: Decimal,
    /// Einheit der Verpackungsgröße.
    pub unit: MaterialUnit,
    /// Preis einer Verpackung in Euro.
    pub price: Decimal,
    /// Frei definierbare eigene Eigenschaften.
    #[serde(default)]
    pub properties: BTreeMap<String, String>,
}

impl Material {
    /// Erzeugt ein Material mit den Standardwerten (Dichte 1,24 g/cm³, 1 kg).
    ///
    /// Der `id`-Wert wird zufällig als UUID v4 vergeben.
    pub fn new(name: impl Into<String>, material_type: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.into(),
            material_type: material_type.into(),
            family: MaterialFamily::Filament,
            manufacturer: None,
            shop_link: None,
            density_g_cm3: Decimal::new(124, 2),
            package_size: Decimal::from(1),
            unit: MaterialUnit::Kg,
            price: Decimal::ZERO,
            properties: BTreeMap::new(),
        }
    }

    /// Berechnet den **Preis pro Gramm** des Materials.
    ///
    /// ```text
    /// preis_pro_gramm = materialpreis / (verpackungsgröße × einheitenfaktor)
    /// ```
    ///
    /// Eine Verpackungsgröße von `0` liefert `Err(CalcError::DivisionByZero)`
    /// und **nicht** `0` oder einen Panic (Spec 0003, Randfälle).
    pub fn price_per_gram(&self) -> Result<Decimal, crate::calc::CalcError> {
        let package_grams = self.package_size * self.unit.grams_per_unit();
        money::checked_divide(self.price, package_grams, "package_size")
    }

    /// Gewicht eines Bauteils in Gramm, wenn nur Volumen und Dichte bekannt sind.
    ///
    /// ```text
    /// gewicht_g = volumen_cm3 × dichte_g_cm3
    /// ```
    pub fn weight_from_volume(&self, volume_cm3: Decimal) -> Decimal {
        volume_cm3 * self.density_g_cm3
    }
}
