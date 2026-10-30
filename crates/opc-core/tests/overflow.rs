//! Regressionstests: extreme Eingaben liefern Fehler statt Panics.

use opc_core::calc::calculate;
use opc_core::model::{
    CalculationFileInput, CalculationInput, FileMaterial, Material, PrintProcess, Printer,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

fn base_input() -> CalculationInput {
    let mut material = Material::new("PLA", "PLA");
    material.density_g_cm3 = dec!(1.24);
    material.package_size = dec!(1);
    material.price = dec!(25);

    let mut file = CalculationFileInput::new("Teil.stl", 2, dec!(2));
    file.materials.push(FileMaterial::new(material));

    let mut input = CalculationInput::new("Overflow", Printer::new("P", PrintProcess::Fdm));
    input.files.push(file);
    input
}

#[test]
fn extrem_grosse_druckzeit_liefert_arithmetic_statt_panic() {
    let mut input = base_input();
    input.files[0].print_time_hours = Decimal::MAX;

    let result = std::panic::catch_unwind(|| calculate(&input));
    assert!(result.is_ok(), "calculate darf nicht panicen");
    assert!(result.unwrap().is_err(), "Überlauf muss ein Err sein");
}

#[test]
fn extrem_grosse_verpackung_liefert_arithmetic_statt_panic() {
    let mut material = Material::new("PLA", "PLA");
    material.package_size = Decimal::MAX;
    material.price = Decimal::ONE;

    let result = std::panic::catch_unwind(|| material.price_per_gram());
    assert!(result.is_ok(), "price_per_gram darf nicht panicen");
    assert!(result.unwrap().is_err(), "Überlauf muss ein Err sein");
}

#[test]
fn extrem_grosses_bauvolumen_liefert_arithmetic_statt_panic() {
    let mut printer = Printer::new("P", PrintProcess::Fdm);
    printer.build_width_mm = Decimal::MAX;
    printer.build_depth_mm = Decimal::from(2);
    printer.build_height_mm = Decimal::from(2);

    let result = std::panic::catch_unwind(|| printer.build_volume_mm3());
    assert!(result.is_ok(), "build_volume_mm3 darf nicht panicen");
    assert!(result.unwrap().is_err(), "Überlauf muss ein Err sein");
}
