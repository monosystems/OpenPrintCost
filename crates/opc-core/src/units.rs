//! Einheitenfaktoren für Materialverpackungen.
//!
//! Ein Material wird in der Praxis als „1 kg Spule", „500 g Rolle" oder
//! „1 lb Karton" angeboten. Für die Kostenrechnung wird daraus ein
//! einheitlicher **Preis pro Gramm** abgeleitet (Spec 0001, Abschnitt 3):
//!
//! ```text
//! preis_pro_gramm = materialpreis / (verpackungsgröße × einheitenfaktor)
//! ```

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Einheit, in der eine Materialverpackung abgegeben wird.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MaterialUnit {
    /// Kilogramm — Faktor 1000 g.
    Kg,
    /// Gramm — Faktor 1 g.
    G,
    /// Pfund — Faktor 453,592 g.
    Lb,
    /// Unze — Faktor 28,3495 g.
    Oz,
}

impl MaterialUnit {
    /// Anzahl Gramm, die einer Einheit dieser Verpackungseinheit entsprechen.
    ///
    /// ```
    /// use opc_core::units::MaterialUnit;
    /// use rust_decimal_macros::dec;
    ///
    /// assert_eq!(MaterialUnit::Kg.grams_per_unit(), dec!(1000));
    /// assert_eq!(MaterialUnit::Lb.grams_per_unit(), dec!(453.592));
    /// ```
    pub fn grams_per_unit(self) -> Decimal {
        match self {
            MaterialUnit::Kg => Decimal::from(1000),
            MaterialUnit::G => Decimal::from(1),
            MaterialUnit::Lb => Decimal::new(453_592, 3),
            MaterialUnit::Oz => Decimal::new(283_495, 4),
        }
    }

    /// Kurzzeichen der Einheit für die Anzeige (`kg`, `g`, `lb`, `oz`).
    pub fn symbol(self) -> &'static str {
        match self {
            MaterialUnit::Kg => "kg",
            MaterialUnit::G => "g",
            MaterialUnit::Lb => "lb",
            MaterialUnit::Oz => "oz",
        }
    }
}

impl fmt::Display for MaterialUnit {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.symbol())
    }
}
