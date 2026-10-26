//! Tests des versionierten Kalkulations-Austauschformats.

use opc_core::model::{
    CalculationFileInput, CalculationInput, FileMaterial, Material, PrintProcess, Printer,
};
use opc_store::StoreError;
use opc_store::document::{
    CALCULATION_DOCUMENT_FORMAT, CALCULATION_DOCUMENT_VERSION, CalculationDocument, from_json,
    to_json,
};
use rust_decimal_macros::dec;

fn fixture() -> CalculationInput {
    let mut material = Material::new("PLA", "PLA");
    material.price = dec!(25);
    material.density_g_cm3 = dec!(1.24);

    let mut file = CalculationFileInput::new("Gehäuse.stl", 2, dec!(1.5));
    file.volume_cm3 = Some(dec!(12.4));
    file.dimensions_mm = Some([dec!(80), dec!(60), dec!(40)]);
    file.materials.push(FileMaterial::new(material));

    let mut input =
        CalculationInput::new("Austauschprojekt", Printer::new("MK4", PrintProcess::Fdm));
    input.files.push(file);
    input
}

#[test]
fn round_trip_erhaelt_alle_werte() {
    let input = fixture();
    let json = to_json(&input).expect("Serialisierung muss gelingen");
    let restored = from_json(&json).expect("Deserialisierung muss gelingen");

    assert_eq!(restored, input);
    assert!(json.contains(CALCULATION_DOCUMENT_FORMAT));
    assert!(json.contains("\"version\": 1"));
    assert!(json.contains("\"dimensions_mm\""));
}

#[test]
fn fremdes_format_wird_abgelehnt() {
    let mut document = CalculationDocument::new(&fixture());
    document.format = "some.other.format".to_string();
    let error = from_json(&serde_json::to_string(&document).unwrap()).expect_err("muss scheitern");

    assert!(matches!(
        error,
        StoreError::UnsupportedDocument { found, .. } if found == "some.other.format"
    ));
}

#[test]
fn neuere_version_wird_abgelehnt() {
    let mut document = CalculationDocument::new(&fixture());
    document.version = CALCULATION_DOCUMENT_VERSION + 1;
    let error = from_json(&serde_json::to_string(&document).unwrap()).expect_err("muss scheitern");

    assert!(matches!(
        error,
        StoreError::UnsupportedDocumentVersion { found, supported }
            if found == CALCULATION_DOCUMENT_VERSION + 1
                && supported == CALCULATION_DOCUMENT_VERSION
    ));
}

#[test]
fn unlesbares_json_wird_abgelehnt() {
    let error = from_json("{ kein json").expect_err("muss scheitern");
    assert!(matches!(error, StoreError::InvalidDocument { .. }));
}
