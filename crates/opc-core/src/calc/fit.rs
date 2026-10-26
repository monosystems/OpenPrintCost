//! Druckbarkeits-Check gegen das Bauvolumen eines Druckers.
//!
//! Der Check ist eine reine Geometrieprüfung: Die achsenparallelen Außenmaße
//! eines Stücks werden mit den maximalen Druckmaßen des Druckers verglichen.
//! Eine Rotation des Bauteils wird nicht berücksichtigt.

use crate::model::printer::Printer;
use rust_decimal::Decimal;

/// Prüft, ob ein Stück mit den gegebenen Außenmaßen in das Bauvolumen passt.
///
/// Die Reihenfolge ist immer Breite (X), Tiefe (Y), Höhe (Z).
///
/// `None` bedeutet **nicht geprüft**: Es fehlen Maße, oder das Bauvolumen ist
/// nicht vollständig gepflegt (mindestens eine Kante ist 0). Ein Wert von
/// `false` bedeutet dagegen nachweislich, dass mindestens eine Kante zu groß
/// ist.
pub fn fits_build_volume(dimensions_mm: [Decimal; 3], printer: &Printer) -> Option<bool> {
    let build = [
        printer.build_width_mm,
        printer.build_depth_mm,
        printer.build_height_mm,
    ];
    if dimensions_mm
        .iter()
        .chain(build.iter())
        .any(|value| *value <= Decimal::ZERO)
    {
        return None;
    }

    Some(
        dimensions_mm
            .iter()
            .zip(build.iter())
            .all(|(dimension, maximum)| dimension <= maximum),
    )
}

#[cfg(test)]
mod tests {
    use super::fits_build_volume;
    use crate::model::printer::{PrintProcess, Printer};
    use rust_decimal_macros::dec;

    fn printer() -> Printer {
        let mut printer = Printer::new("Test", PrintProcess::Fdm);
        printer.build_width_mm = dec!(250);
        printer.build_depth_mm = dec!(210);
        printer.build_height_mm = dec!(220);
        printer
    }

    #[test]
    fn passendes_stueck_wird_erkannt() {
        assert_eq!(
            fits_build_volume([dec!(250), dec!(210), dec!(220)], &printer()),
            Some(true)
        );
    }

    #[test]
    fn zu_grosse_kante_ist_false() {
        assert_eq!(
            fits_build_volume([dec!(250.01), dec!(100), dec!(100)], &printer()),
            Some(false)
        );
    }

    #[test]
    fn unvollstaendige_angaben_werden_nicht_geprueft() {
        assert_eq!(
            fits_build_volume([dec!(100), dec!(0), dec!(100)], &printer()),
            None
        );

        let mut incomplete = printer();
        incomplete.build_height_mm = dec!(0);
        assert_eq!(
            fits_build_volume([dec!(100), dec!(100), dec!(100)], &incomplete),
            None
        );
    }
}
