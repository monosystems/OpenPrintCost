//! Stellt sicher, dass die von der Oberfläche genutzte Core-Fixture aktuell ist.

use opc_core::calc::calculate;
use opc_core::model::{CalculationInput, CalculationResult};
use serde::Deserialize;

const FIXTURE: &str = include_str!("../../../src/test/fixtures/core-calculation.json");

#[derive(Deserialize)]
struct Fixture {
    input: CalculationInput,
    result: CalculationResult,
}

#[test]
fn ui_fixture_entspricht_dem_aktuellen_rechenkern() {
    let fixture: Fixture = serde_json::from_str(FIXTURE).expect("Fixture muss lesbar sein");
    let actual = calculate(&fixture.input).expect("Fixture muss berechenbar sein");

    assert_eq!(actual.project_name, fixture.result.project_name);
    assert_eq!(actual.created_at, fixture.result.created_at);
    assert_eq!(actual.notes, fixture.result.notes);
    assert_eq!(actual.base_total, fixture.result.base_total);
    assert_eq!(actual.margin_total, fixture.result.margin_total);
    assert_eq!(actual.tax_total, fixture.result.tax_total);
    assert_eq!(actual.total, fixture.result.total);
    assert_eq!(actual.total_quantity, fixture.result.total_quantity);
    assert_eq!(actual.cost_per_piece, fixture.result.cost_per_piece);
    assert_eq!(actual.price_per_piece, fixture.result.price_per_piece);
    assert_eq!(actual.files.len(), fixture.result.files.len());
    assert_eq!(actual.positions.len(), fixture.result.positions.len());

    for (actual, expected) in actual.positions.iter().zip(&fixture.result.positions) {
        assert_eq!(actual.group, expected.group);
        assert_eq!(actual.label, expected.label);
        assert_eq!(actual.detail, expected.detail);
        assert_eq!(actual.amount, expected.amount);
        assert_eq!(actual.file_id, expected.file_id);
        assert_eq!(actual.is_fail_rate, expected.is_fail_rate);
    }
}
