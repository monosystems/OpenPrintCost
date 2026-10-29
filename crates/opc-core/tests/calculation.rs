//! Integrationstests des Rechenkerns.
//!
//! Die Sollwerte sind **von Hand nachgerechnet** (Spec 0003, Abschnitt
//! „Festwert-Tests") und nicht aus der Implementierung erzeugt.

use opc_core::calc::calculate;
use opc_core::calc::{CalcError, machine_hour_rate};
use opc_core::model::{
    CalculationFileInput, CalculationInput, CalculationProfile, CostGroup, CustomSurcharge,
    FileMaterial, HandlingFeeScope, HourlyRate, Material, PrintProcess, Printer, SurchargeTiming,
    TimeBasis, Workstep, WorkstepCalculationType, WorkstepCategory,
};
use opc_core::units::MaterialUnit;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

/// Ein Material „PLA“: 1 kg für 25,00 €, Dichte 1,24 g/cm³.
fn pla_material() -> Material {
    let mut material = Material::new("PLA", "PLA");
    material.price = dec!(25);
    material.package_size = dec!(1);
    material.unit = MaterialUnit::Kg;
    material.density_g_cm3 = dec!(1.24);
    material
}

/// Ein zweites Material „PETG“: 1 kg für 30,00 €, Dichte 1,27 g/cm³.
fn petg_material() -> Material {
    let mut material = Material::new("PETG", "PETG");
    material.price = dec!(30);
    material.package_size = dec!(1);
    material.unit = MaterialUnit::Kg;
    material.density_g_cm3 = dec!(1.27);
    material
}

/// Ein Drucker mit 100 W und 25 €/h Maschinenstundensatz.
fn test_printer() -> Printer {
    let mut printer = Printer::new("Test-Drucker", PrintProcess::Fdm);
    printer.power_watts = dec!(100);
    printer.hourly_rate = Some(dec!(25));
    printer
}

/// Die Standard-Fixture: ein Bauteil, 10 cm³, 2 h Druckzeit, 1 Stück.
fn base_input() -> CalculationInput {
    let mut file = CalculationFileInput::new("Bauteil.stl", 1, dec!(2));
    file.volume_cm3 = Some(dec!(10));
    file.materials.push(FileMaterial::new(pla_material()));

    let mut input = CalculationInput::new("Testprojekt", test_printer());
    input.profile = CalculationProfile {
        apply_energy_costs: true,
        energy_price_per_kwh: dec!(0.35),
        ..CalculationProfile::default()
    };
    input.files.push(file);
    input
}

// ---------------------------------------------------------------------------
// Materialkosten
// ---------------------------------------------------------------------------

#[test]
fn materialkosten_sind_exakt() {
    let input = base_input();
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // gewicht_g = 10 cm³ × 1,24 g/cm³ = 12,40 g
    // preis_pro_gramm = 25,00 € / 1000 g = 0,025 €/g
    // materialkosten = 12,40 g × 0,025 €/g = 0,31 €
    let material = result.group_total(CostGroup::Material);
    assert_eq!(material, dec!(0.31));

    assert_eq!(result.files[0].material_g, dec!(12.40));
}

#[test]
fn preis_pro_gramm_beruecksichtigt_einheitenfaktor() {
    let mut material = pla_material();
    material.package_size = dec!(2);
    material.unit = MaterialUnit::Lb;
    material.price = dec!(10);

    // 2 lb = 2 × 453,592 g = 907,184 g → 10 € / 907,184 g
    let price_per_gram = material.price_per_gram().expect("kein Divisionsfehler");
    assert_eq!(price_per_gram, dec!(10) / dec!(907.184));
}

#[test]
fn materialkosten_je_gramm_sind_unveraendert() {
    let mut material = pla_material();
    material.package_size = dec!(500);
    material.unit = MaterialUnit::G;
    material.price = dec!(12.5);

    // 500 g für 12,50 € → 0,025 €/g
    assert_eq!(material.price_per_gram().unwrap(), dec!(0.025));
}

#[test]
fn mehrere_materialien_mit_eigenem_volumen_werden_korrekt_berechnet() {
    let mut input = base_input();
    let file = &mut input.files[0];
    file.materials = vec![
        FileMaterial::new(pla_material()).with_volume_cm3(dec!(6)),
        FileMaterial::new(petg_material()).with_volume_cm3(dec!(4)),
    ];

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // PLA:  6 cm³ × 1,24 g/cm³ = 7,44 g × 0,025 €/g = 0,1860 €
    // PETG: 4 cm³ × 1,27 g/cm³ = 5,08 g × 0,030 €/g = 0,1524 €
    assert_eq!(result.group_total(CostGroup::Material), dec!(0.3384));
    assert_eq!(result.files[0].material_g, dec!(12.52));
}

#[test]
fn mehrere_materialien_koennen_zu_einer_position_zusammengefasst_werden() {
    let mut input = base_input();
    input.profile.combine_materials = true;
    input.files[0].materials = vec![
        FileMaterial::new(pla_material()).with_volume_cm3(dec!(6)),
        FileMaterial::new(petg_material()).with_volume_cm3(dec!(4)),
    ];

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let material_positions: Vec<_> = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::Material)
        .collect();
    assert_eq!(material_positions.len(), 1);
    assert_eq!(material_positions[0].amount, dec!(0.3384));
    assert_eq!(material_positions[0].quantity, Some(dec!(12.52)));
}

#[test]
fn materialvolumen_ueberschreibt_das_dateivolumen() {
    let mut input = base_input();
    let file = &mut input.files[0];
    file.volume_cm3 = Some(dec!(10));
    file.materials = vec![FileMaterial::new(pla_material()).with_volume_cm3(dec!(5))];

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // 5 cm³ × 1,24 g/cm³ = 6,20 g × 0,025 €/g = 0,155 €
    assert_eq!(result.group_total(CostGroup::Material), dec!(0.155));
    assert_eq!(result.files[0].material_g, dec!(6.20));
}

#[test]
fn materialgewicht_hat_vorrang_vor_materialvolumen() {
    let mut input = base_input();
    let file = &mut input.files[0];
    let mut material = FileMaterial::new(pla_material()).with_volume_cm3(dec!(10));
    material.weight_g = Some(dec!(5));
    file.materials = vec![material];

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // 5 g × 0,025 €/g = 0,125 €; das Volumen würde 12,40 g ergeben.
    assert_eq!(result.group_total(CostGroup::Material), dec!(0.125));
    assert_eq!(result.files[0].material_g, dec!(5));
}

#[test]
fn mehrere_materialien_ohne_zuordnung_sind_ein_fehler() {
    let mut input = base_input();
    input.files[0].materials = vec![
        FileMaterial::new(pla_material()),
        FileMaterial::new(petg_material()),
    ];

    let error = calculate(&input).expect_err("Mehrere Materialien ohne Zuordnung müssen scheitern");

    assert!(matches!(
        error,
        CalcError::AmbiguousMaterialAllocation { file_name } if file_name == "Bauteil.stl"
    ));
}

#[test]
fn materialwechsel_erzeugt_einen_zuschlag() {
    let mut input = base_input();
    input.printer.material_change_cost = Some(dec!(2.5));
    input.files[0].material_changes = 3;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let position = result
        .positions
        .iter()
        .find(|position| position.label == "Materialwechsel")
        .expect("Materialwechsel-Position fehlt");

    // 3 Wechsel × 2,50 € = 7,50 €
    assert_eq!(position.amount, dec!(7.5));
    assert_eq!(position.quantity, Some(dec!(3)));
}

// ---------------------------------------------------------------------------
// Energiekosten
// ---------------------------------------------------------------------------

#[test]
fn energiekosten_sind_exakt() {
    let input = base_input();
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // verbrauch_kwh = 2 h × 100 W / 1000 × 100 % = 0,2 kWh
    // energiekosten = 0,2 kWh × 0,35 €/kWh = 0,07 €
    assert_eq!(result.group_total(CostGroup::Energy), dec!(0.07));
}

#[test]
fn energiekosten_werden_nicht_angewendet_wenn_ausgeschaltet() {
    let mut input = base_input();
    input.profile.apply_energy_costs = false;
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.group_total(CostGroup::Energy), dec!(0));
}

#[test]
fn leistungsgrad_senkt_den_verbrauch() {
    let mut input = base_input();
    input.profile.power_level_percent = dec!(75);
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // 2 h × 100 W / 1000 × 75 % = 0,15 kWh × 0,35 €/kWh = 0,0525 €
    assert_eq!(result.group_total(CostGroup::Energy), dec!(0.0525));
}

// ---------------------------------------------------------------------------
// Maschinenkosten
// ---------------------------------------------------------------------------

#[test]
fn maschinenkosten_sind_exakt() {
    let input = base_input();
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // 2 h × 25 €/h = 50,00 €
    assert_eq!(result.group_total(CostGroup::Machine), dec!(50));
}

// ---------------------------------------------------------------------------
// Fehlerrate
// ---------------------------------------------------------------------------

#[test]
fn fehlerrate_erzeugt_zusaetzliche_positionen() {
    let mut input = base_input();
    input.profile.fail_rate_percent = dec!(10);
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // druckzeit_fehler = 2 h × 10 % = 0,2 h
    assert_eq!(result.files[0].print_time_hours_fail, dec!(0.2));
    // material_g_fehler = 12,40 g × 10 % = 1,24 g
    assert_eq!(result.files[0].material_g_fail, dec!(1.24));

    // materialkosten_fehler = 1,24 g × 0,025 €/g = 0,031 €
    let material_fail: Decimal = result
        .positions
        .iter()
        .filter(|position| position.is_fail_rate && position.group == CostGroup::Material)
        .map(|position| position.amount)
        .sum();
    assert_eq!(material_fail, dec!(0.031));

    // Die Fehlerrate erzeugt zusätzliche Maschinenkosten: 0,2 h × 25 €/h = 5,00 €
    let machine_fail: Decimal = result
        .positions
        .iter()
        .filter(|position| position.is_fail_rate && position.group == CostGroup::Machine)
        .map(|position| position.amount)
        .sum();
    assert_eq!(machine_fail, dec!(5));

    // Und zusätzliche Energiekosten: 0,02 kWh × 0,35 €/kWh = 0,007 €
    let energy_fail: Decimal = result
        .positions
        .iter()
        .filter(|position| position.is_fail_rate && position.group == CostGroup::Energy)
        .map(|position| position.amount)
        .sum();
    assert_eq!(energy_fail, dec!(0.007));
}

#[test]
fn fehlerrate_null_erzeugt_keine_zusatzpositionen() {
    let mut input = base_input();
    input.profile.fail_rate_percent = dec!(0);
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert!(
        result
            .positions
            .iter()
            .all(|position| !position.is_fail_rate),
        "Bei Fehlerrate 0 darf keine FailRate-Position entstehen"
    );
}

// ---------------------------------------------------------------------------
// Maschinenstundensatz
// ---------------------------------------------------------------------------

#[test]
fn maschinenstundensatz_berechnung_ist_exakt() {
    let mut rate = HourlyRate::new("Büro");
    rate.time_basis = TimeBasis::PerYear;
    rate.machine_hours = dec!(800);
    rate.replacement_cost = dec!(1000);
    rate.service_life_years = dec!(4);
    rate.interest_rate_percent = dec!(3);
    rate.maintenance_fixed = dec!(50);
    rate.rent_fixed = dec!(20);
    rate.electricity_fixed = dec!(30);
    rate.additional_fixed = dec!(10);
    rate.maintenance_variable = dec!(5);
    rate.electricity_variable = dec!(10);
    rate.additional_variable = dec!(0);

    // abschreibung = 1000 / 4 = 250
    // zins         = (1000 / 2) / 100 × 3 = 15
    // stundensatz  = (250 + 15 + 110 + 15) / 800 = 0,4875 €/h
    assert_eq!(
        machine_hour_rate::calculate_hourly_rate(&rate).unwrap(),
        dec!(0.4875)
    );
}

#[test]
fn maschinenstundensatz_monatsbasis_multipliziert_fixkosten_mit_zwoelf() {
    let mut rate = HourlyRate::new("Monat");
    rate.time_basis = TimeBasis::PerMonth;
    rate.machine_hours = dec!(100); // 1200 h pro Jahr
    rate.replacement_cost = dec!(1000);
    rate.service_life_years = dec!(4);
    rate.interest_rate_percent = dec!(3);
    rate.rent_fixed = dec!(20); // 20 € pro Monat

    // abschreibung = 250, zins = 15
    // fixkosten     = 20 × 12 = 240
    // stundensatz   = (250 + 15 + 240) / (100 × 12) = 505 / 1200 = 0,42083333...
    let expected = dec!(505) / dec!(1200);
    assert_eq!(
        machine_hour_rate::calculate_hourly_rate(&rate).unwrap(),
        expected
    );
}

#[test]
fn freier_stundensatz_ueberschreibt_die_berechnung() {
    let mut rate = HourlyRate::new("Fest");
    rate.machine_hours = dec!(800);
    rate.replacement_cost = dec!(1000);
    rate.service_life_years = dec!(4);
    rate.fixed_rate_override = Some(dec!(42));

    assert_eq!(
        machine_hour_rate::calculate_hourly_rate(&rate).unwrap(),
        dec!(42)
    );
}

#[test]
fn stundensatz_ist_null_wenn_maschinenstunden_null_sind() {
    let mut rate = HourlyRate::new("Leer");
    rate.machine_hours = dec!(0);
    rate.replacement_cost = dec!(1000);
    rate.service_life_years = dec!(4);

    assert_eq!(
        machine_hour_rate::calculate_hourly_rate(&rate).unwrap(),
        dec!(0)
    );
}

// ---------------------------------------------------------------------------
// Marge und Steuer
// ---------------------------------------------------------------------------

#[test]
fn marge_und_steuer_sind_exakt() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.profile.tax_rate_percent = dec!(19);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // basis = Material 0,31 + Maschine 50,00 + Energie 0,07 = 50,38
    assert_eq!(result.base_total, dec!(50.38));
    // marge = 50,38 × 20 % = 10,076
    assert_eq!(result.margin_total, dec!(10.076));
    // steuer = (50,38 + 10,076) × 19 % = 11,48664
    assert_eq!(result.tax_total, dec!(11.48664));
    // gesamt = 60,456 + 11,48664 = 71,94264
    assert_eq!(result.total, dec!(71.94264));

    // Die Anzeige wird kaufmännisch gerundet.
    assert_eq!(opc_core::money::round_money(result.total), dec!(71.94));
}

#[test]
fn marge_und_steuer_sind_eigene_positionen() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.profile.tax_rate_percent = dec!(19);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let margin_positions = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::Margin)
        .count();
    let tax_positions = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::Tax)
        .count();

    assert_eq!(margin_positions, 1, "Marge muss eine eigene Position sein");
    assert_eq!(tax_positions, 1, "Steuer muss eine eigene Position sein");
}

#[test]
fn marge_null_erzeugt_keine_margenposition() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(0);
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert!(
        result
            .positions
            .iter()
            .all(|position| position.group != CostGroup::Margin)
    );
    assert_eq!(result.margin_total, dec!(0));
}

#[test]
fn steuer_null_erzeugt_keine_steuerposition() {
    let mut input = base_input();
    input.profile.tax_rate_percent = dec!(0);
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert!(
        result
            .positions
            .iter()
            .all(|position| position.group != CostGroup::Tax)
    );
    assert_eq!(result.tax_total, dec!(0));
}

#[test]
fn ausgeschlossene_positionen_wirken_nicht_als_margebasis() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.profile.exclude_machine_from_margin = true;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // basis 50,38 − Maschinenkosten 50,00 = 0,38 → marge = 0,076
    assert_eq!(result.margin_total, dec!(0.076));
    // Die Maschinenkosten bleiben in der Gesamtsumme enthalten.
    assert_eq!(result.total, dec!(50.456));
}

#[test]
fn prozentuale_zuschlaege_wirken_vor_und_nach_der_marge() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.custom_surcharges.push(CustomSurcharge::new(
        "Rüstauftrag",
        dec!(10),
        SurchargeTiming::BeforeMargin,
    ));
    input.custom_surcharges.push(CustomSurcharge::new(
        "Versand",
        dec!(5),
        SurchargeTiming::AfterMargin,
    ));

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // Zuschlag vor Marge: 50,38 × 10 % = 5,038 → basis 55,418
    // Marge: 55,418 × 20 % = 11,0836 → 66,5016
    // Zuschlag nach Marge: 66,5016 × 5 % = 3,32508 → 69,82668
    assert_eq!(result.base_total, dec!(55.418));
    assert_eq!(result.margin_total, dec!(11.0836));
    assert_eq!(result.total, dec!(69.82668));
}

// ---------------------------------------------------------------------------
// Handlungspauschale
// ---------------------------------------------------------------------------

#[test]
fn handlungspauschale_je_datei_positioniert_sich_je_datei() {
    let mut input = base_input();
    input.files[0].quantity = 3;
    input.profile.handling_fee = dec!(5);
    input.profile.handling_fee_scope = HandlingFeeScope::PerFile;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let handling: Vec<_> = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::HandlingFee)
        .collect();

    assert_eq!(handling.len(), 1);
    assert_eq!(handling[0].amount, dec!(15));
    assert_eq!(handling[0].file_id, Some(input.files[0].id));
}

#[test]
fn handlungspauschale_einmal_erzeugt_eine_projektposition() {
    let mut input = base_input();
    input.profile.handling_fee = dec!(5);
    input.profile.handling_fee_scope = HandlingFeeScope::Once;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let handling: Vec<_> = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::HandlingFee)
        .collect();

    assert_eq!(handling.len(), 1);
    assert_eq!(handling[0].amount, dec!(5));
    assert_eq!(handling[0].file_id, None);
}

// ---------------------------------------------------------------------------
// Arbeitsschritte
// ---------------------------------------------------------------------------

#[test]
fn arbeitsschritte_werden_nach_ihrem_typ_berechnet() {
    let category = WorkstepCategory::new("Nachbearbeitung");

    let mut per_piece = Workstep::new(
        "Entstutzung",
        category.clone(),
        WorkstepCalculationType::PerPiece,
        dec!(0.5),
    );
    per_piece.quantity = dec!(1);

    let mut per_hour = Workstep::new(
        "Recherche",
        category.clone(),
        WorkstepCalculationType::PerHour,
        dec!(40),
    );
    per_hour.duration_hours = dec!(0.25);

    let mut per_order = Workstep::new(
        "Versandvorbereitung",
        category,
        WorkstepCalculationType::PerOrder,
        dec!(7.5),
    );
    per_order.quantity = dec!(1);

    let mut input = base_input();
    input.files[0].quantity = 3;
    input.worksteps = vec![per_piece, per_hour, per_order];

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let mut per_piece_amount = Decimal::ZERO;
    let mut per_hour_amount = Decimal::ZERO;
    let mut per_order_amount = Decimal::ZERO;

    for position in result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::Worksteps)
    {
        match position.label.as_str() {
            "Entstutzung" => per_piece_amount = position.amount,
            "Recherche" => per_hour_amount = position.amount,
            "Versandvorbereitung" => per_order_amount = position.amount,
            other => panic!("unerwartete Position: {other}"),
        }
    }

    assert_eq!(per_piece_amount, dec!(1.5));
    assert_eq!(per_hour_amount, dec!(10));
    assert_eq!(per_order_amount, dec!(7.5));
}

#[test]
fn arbeitsschritte_pro_stueck_werden_je_datei_positioniert() {
    let mut input = base_input();
    let mut workstep = Workstep::new(
        "Entstutzung",
        WorkstepCategory::new("Nachbearbeitung"),
        WorkstepCalculationType::PerPiece,
        dec!(0.5),
    );
    workstep.quantity = dec!(1);
    input.worksteps.push(workstep);

    let mut second_file = CalculationFileInput::new("Deckel.stl", 2, dec!(1));
    second_file.volume_cm3 = Some(dec!(5));
    second_file
        .materials
        .push(FileMaterial::new(pla_material()));
    input.files.push(second_file);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let per_piece: Vec<_> = result
        .positions
        .iter()
        .filter(|position| position.label == "Entstutzung")
        .collect();

    assert_eq!(per_piece.len(), 2, "pro Stück wird je Datei positioniert");
    assert_eq!(per_piece[0].amount, dec!(0.5));
    assert_eq!(per_piece[1].amount, dec!(1));
}

// ---------------------------------------------------------------------------
// Zwischenschritte der Druckzeit
// ---------------------------------------------------------------------------

#[test]
fn druckzeit_wird_mit_stueckzahl_multipliziert() {
    let mut input = base_input();
    input.files[0].quantity = 3;
    input.profile.multiply_print_time_with_quantity = true;
    input.profile.print_time_factor = dec!(1);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // 2 h × 3 Stück = 6 h × 25 €/h = 150,00 €
    assert_eq!(result.files[0].print_time_hours, dec!(6));
    assert_eq!(result.group_total(CostGroup::Machine), dec!(150));
}

#[test]
fn datei_kann_profil_einstellung_ueberschreiben() {
    let mut input = base_input();
    input.files[0].quantity = 3;
    input.profile.multiply_print_time_with_quantity = false;
    input.files[0].multiply_print_time_with_quantity = Some(true);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.files[0].print_time_hours, dec!(6));
}

// ---------------------------------------------------------------------------
// Erzwungene Randfälle
// ---------------------------------------------------------------------------

#[test]
fn stueckzahl_null_erzeugt_keine_material_und_maschinenpositionen() {
    let mut input = base_input();
    input.files[0].quantity = 0;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.group_total(CostGroup::Material), dec!(0));
    assert_eq!(result.group_total(CostGroup::Machine), dec!(0));
    assert_eq!(result.total, dec!(0));
}

#[test]
fn maschinenstunden_null_ergibt_nullen_stundensatz() {
    let mut input = base_input();
    let mut rate = HourlyRate::new("Leer");
    rate.machine_hours = dec!(0);
    rate.replacement_cost = dec!(1000);
    rate.service_life_years = dec!(4);
    input.hourly_rate = Some(rate);
    input.printer.hourly_rate = None;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.machine_hour_rate, dec!(0));
    assert_eq!(result.group_total(CostGroup::Machine), dec!(0));
}

#[test]
fn nutzungsdauer_null_ergibt_keine_abschreibung() {
    let mut rate = HourlyRate::new("Ohne Abschreibung");
    rate.machine_hours = dec!(800);
    rate.replacement_cost = dec!(1000);
    rate.service_life_years = dec!(0);
    rate.interest_rate_percent = dec!(3);

    // abschreibung = 0, zins = 15 → (0 + 15) / 800 = 0,01875
    assert_eq!(
        machine_hour_rate::calculate_hourly_rate(&rate).unwrap(),
        dec!(0.01875)
    );
}

#[test]
fn druckzeit_null_ergibt_keine_energiekosten() {
    let mut input = base_input();
    input.files[0].print_time_hours = dec!(0);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.group_total(CostGroup::Energy), dec!(0));
}

#[test]
fn dichte_null_ergibt_kein_materialgewicht_und_keine_kosten() {
    let mut input = base_input();
    input.files[0].materials[0].material.density_g_cm3 = dec!(0);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.files[0].material_g, dec!(0));
    assert_eq!(result.group_total(CostGroup::Material), dec!(0));
}

#[test]
fn verpackungsgroesse_null_ist_ein_fehler_und_kein_panic() {
    let mut input = base_input();
    input.files[0].materials[0].material.package_size = dec!(0);

    let error = calculate(&input).expect_err("muss einen Fehler liefern");

    assert_eq!(
        error,
        CalcError::DivisionByZero {
            field: "package_size"
        }
    );
}

#[test]
fn negative_werte_bleiben_sichtbar() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(-10);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.margin_total, dec!(-5.038));
    assert!(
        result
            .positions
            .iter()
            .any(|position| position.group == CostGroup::Margin
                && position.amount.is_sign_negative())
    );
}

// ---------------------------------------------------------------------------
// Vertragserfüllung der Engine
// ---------------------------------------------------------------------------

#[test]
fn engine_ist_pure_und_veraendert_die_eingabe_nicht() {
    let input = base_input();
    let before = input.clone();

    let first = calculate(&input).expect("Berechnung muss erfolgreich sein");
    let second = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(input, before, "die Eingabe darf nicht verändert werden");
    assert_eq!(
        first.total, second.total,
        "die Engine muss deterministisch sein"
    );
    assert_eq!(first.positions.len(), second.positions.len());
}

#[test]
fn ergebnis_serialisiert_decimal_als_string() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.profile.tax_rate_percent = dec!(19);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");
    let json = serde_json::to_string(&result).expect("Serialisierung muss gelingen");

    assert!(
        json.contains("\"total\":\"71.94264\""),
        "Decimal muss als String serialisiert werden: {json}"
    );
    assert!(
        !json.contains("\"total\":71"),
        "Decimal darf nicht als Zahl serialisiert werden: {json}"
    );
    assert!(
        !json.contains("\"amount\":0.31"),
        "Beträge dürfen nicht als Zahl serialisiert werden: {json}"
    );
}

#[test]
fn ergebnis_ist_round_trip_faehig() {
    let input = base_input();
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let json = serde_json::to_string(&result).expect("Serialisierung muss gelingen");
    let restored: opc_core::model::CalculationResult =
        serde_json::from_str(&json).expect("Deserialisierung muss gelingen");

    assert_eq!(restored.total, result.total);
    assert_eq!(restored.positions.len(), result.positions.len());
}

#[test]
fn alte_dokumente_ohne_bauteilmass_lassen_sich_lesen() {
    let input = base_input();
    let mut document = serde_json::to_value(&input).expect("Serialisierung muss gelingen");
    for file in document["files"]
        .as_array_mut()
        .expect("Dateiliste muss ein Array sein")
    {
        file.as_object_mut()
            .expect("Datei muss ein Objekt sein")
            .remove("dimensions_mm");
    }

    let restored: CalculationInput =
        serde_json::from_value(document).expect("altes Dokument muss lesbar bleiben");
    assert_eq!(restored.files[0].dimensions_mm, None);
}

#[test]
fn alle_entitaeten_tragen_uuid_v4() {
    let input = base_input();
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(input.id.get_version_num(), 4);
    assert_eq!(input.printer.id.get_version_num(), 4);
    assert_eq!(input.files[0].id.get_version_num(), 4);
    assert_eq!(input.files[0].materials[0].material.id.get_version_num(), 4);
    assert_eq!(result.id.get_version_num(), 4);
}

#[test]
fn positionen_sind_nach_kostenbloecken_sortiert() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.profile.tax_rate_percent = dec!(19);
    input.profile.handling_fee = dec!(5);
    input.profile.handling_fee_scope = HandlingFeeScope::Once;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let groups: Vec<CostGroup> = result.positions.iter().map(|p| p.group).collect();

    let index_of = |group: CostGroup| groups.iter().position(|g| *g == group).unwrap();

    // Innerhalb einer Datei: Material → Maschine → Energie → Marge → Steuer.
    assert!(index_of(CostGroup::Material) < index_of(CostGroup::Machine));
    assert!(index_of(CostGroup::Machine) < index_of(CostGroup::Energy));
    assert!(index_of(CostGroup::Energy) < index_of(CostGroup::Margin));
    assert!(index_of(CostGroup::Margin) < index_of(CostGroup::Tax));

    // Die einmalige Handlungspauschale gehört zur Projektebene und steht
    // deshalb hinter den Dateipositionen — vor der Gesamtposition.
    assert!(index_of(CostGroup::HandlingFee) < index_of(CostGroup::Total));
    assert!(index_of(CostGroup::Tax) < index_of(CostGroup::Total));
}

#[test]
fn marge_und_steuer_werden_je_datei_berechnet() {
    let mut input = base_input();
    input.profile.margin_percent = dec!(20);
    input.profile.tax_rate_percent = dec!(19);

    let mut second_file = CalculationFileInput::new("Deckel.stl", 1, dec!(1));
    second_file.volume_cm3 = Some(dec!(5));
    second_file
        .materials
        .push(FileMaterial::new(pla_material()));
    input.files.push(second_file);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // Datei 1: Material 0,31 + Maschine 50,00 + Energie 0,07 = 50,38
    //          Marge 20 % = 10,076 → 60,456 → Steuer 19 % = 11,48664
    // Datei 2: Material 0,155 + Maschine 25,00 + Energie 0,035 = 25,19
    //          Marge 20 % = 5,038 → 30,228 → Steuer 19 % = 5,74332
    let margins: Vec<_> = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::Margin)
        .collect();
    let taxes: Vec<_> = result
        .positions
        .iter()
        .filter(|position| position.group == CostGroup::Tax)
        .collect();

    assert_eq!(margins.len(), 2, "jede Datei bekommt ihre eigene Marge");
    assert_eq!(taxes.len(), 2, "jede Datei bekommt ihre eigene Steuer");
    assert_eq!(margins[0].amount, dec!(10.076));
    assert_eq!(margins[1].amount, dec!(5.038));
    assert_eq!(result.base_total, dec!(75.57));
    assert_eq!(result.margin_total, dec!(15.114));
    assert_eq!(result.tax_total, dec!(17.22996));
    assert_eq!(result.total, dec!(107.91396));
}

#[test]
fn einmalige_handlungspauschale_traegt_ihre_eigene_marge() {
    let mut input = base_input();
    input.profile.handling_fee = dec!(5);
    input.profile.handling_fee_scope = HandlingFeeScope::Once;
    input.profile.margin_percent = dec!(20);
    input.profile.tax_rate_percent = dec!(19);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // Dateiebene: basis 50,38 → Marge 10,076 → 60,456 → Steuer 11,48664 = 71,94264
    // Projektebene: Pauschale 5,00 → eigene Marge 1,00 → 6,00 → Steuer 1,14 = 7,14
    assert_eq!(result.base_total, dec!(55.38));
    assert_eq!(result.margin_total, dec!(11.076));
    assert_eq!(result.tax_total, dec!(12.62664));
    assert_eq!(result.total, dec!(79.08264));
}

// ---------------------------------------------------------------------------
// Verkaufspreis und Stückpreis
// ---------------------------------------------------------------------------

#[test]
fn gesamtposition_heisst_verkaufspreis() {
    let input = base_input();
    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    let total = result
        .positions
        .iter()
        .find(|position| position.group == CostGroup::Total)
        .expect("Gesamtposition fehlt");

    assert_eq!(total.label, "Verkaufspreis");
    assert_eq!(total.amount, result.total);
}

#[test]
fn stueckpreise_werden_aus_der_gesamtmenge_geliefert() {
    let mut input = base_input();
    input.files[0].quantity = 3;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    // Material 37,20 g × 0,025 = 0,93
    // Maschine 6 h × 25 = 150,00
    // Energie 0,6 kWh × 0,35 = 0,21
    // Summe = 151,14; ohne Marge/Steuer ist der Verkaufspreis gleich den Kosten.
    assert_eq!(result.total_quantity, 3);
    assert_eq!(result.base_total, dec!(151.14));
    assert_eq!(result.total, dec!(151.14));
    assert_eq!(result.cost_per_piece, Some(dec!(50.38)));
    assert_eq!(result.price_per_piece, Some(dec!(50.38)));
}

#[test]
fn stueckpreise_sind_bei_null_stueckzahl_none() {
    let mut input = base_input();
    input.files[0].quantity = 0;

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.total_quantity, 0);
    assert_eq!(result.cost_per_piece, None);
    assert_eq!(result.price_per_piece, None);
}

// ---------------------------------------------------------------------------
// Druckbarkeit
// ---------------------------------------------------------------------------

#[test]
fn dateizusammenfassung_meldet_passendes_bauvolumen() {
    let mut input = base_input();
    input.printer.build_width_mm = dec!(250);
    input.printer.build_depth_mm = dec!(210);
    input.printer.build_height_mm = dec!(220);
    input.files[0].dimensions_mm = Some([dec!(100), dec!(80), dec!(50)]);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(
        result.files[0].dimensions_mm,
        Some([dec!(100), dec!(80), dec!(50)])
    );
    assert_eq!(result.files[0].fits_build_volume, Some(true));
}

#[test]
fn dateizusammenfassung_meldet_zu_grosses_bauteil() {
    let mut input = base_input();
    input.printer.build_width_mm = dec!(250);
    input.printer.build_depth_mm = dec!(210);
    input.printer.build_height_mm = dec!(220);
    input.files[0].dimensions_mm = Some([dec!(100), dec!(80), dec!(221)]);

    let result = calculate(&input).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.files[0].fits_build_volume, Some(false));
}

#[test]
fn ohne_masse_bleibt_die_druckbarkeit_unbekannt() {
    let result = calculate(&base_input()).expect("Berechnung muss erfolgreich sein");

    assert_eq!(result.files[0].dimensions_mm, None);
    assert_eq!(result.files[0].fits_build_volume, None);
}
