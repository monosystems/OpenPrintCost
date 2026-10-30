//! Integrationstests des Speicherports.
//!
//! Die **gleiche** Testsuite läuft gegen den SQLite-Adapter und den
//! In-Memory-Adapter. Damit ist die Austauschbarkeit des Backends belegt
//! (Spec 0005, Akzeptanzkriterium 4) — und nicht nur behauptet.

use opc_core::model::{
    CalculationFileInput, CalculationInput, CalculationProfile, FileMaterial, HandlingFeeScope,
    HourlyRate, Material, PrintProcess, Printer, TimeBasis, Workstep, WorkstepCalculationType,
    WorkstepCategory, WorkstepTiming,
};
use opc_core::units::MaterialUnit;
use opc_store::{
    CalculationRepository, MaterialRepository, MemoryStore, PrinterRepository, SqliteStore, Store,
    StoreError,
};
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use uuid::Uuid;

/// Führt die Testsuite gegen ein Backend aus.
fn for_each_backend(test: impl Fn(&dyn Store)) {
    let memory = MemoryStore::new();
    test(&memory);

    let sqlite = SqliteStore::open_in_memory().expect("In-Memory-SQLite muss öffnen");
    test(&sqlite);
}

/// Erzeugt einen Drucker mit vollständigen Feldern.
fn test_printer() -> Printer {
    let mut printer = Printer::new("Prusa MK4S", PrintProcess::Fdm);
    printer.manufacturer = Some("Prusa Research".to_string());
    printer.power_watts = dec!(110);
    printer.build_width_mm = dec!(250);
    printer.build_depth_mm = dec!(210);
    printer.build_height_mm = dec!(220);
    printer.purchase_price = dec!(1499);
    printer.hourly_rate = Some(dec!(12.5));
    printer.nozzle_wear_cost = Some(dec!(4.5));
    printer.build_plate_wear_cost = Some(dec!(19.9));
    printer.material_change_cost = Some(dec!(2));
    printer
        .properties
        .insert("Düsendurchmesser".to_string(), "0,4 mm".to_string());
    printer
}

/// Erzeugt ein Material mit vollständigen Feldern.
fn test_material() -> Material {
    let mut material = Material::new("PETG", "PETG");
    material.manufacturer = Some("Prusament".to_string());
    material.shop_link = Some("https://example.invalid/petg".to_string());
    material.density_g_cm3 = dec!(1.27);
    material.package_size = dec!(1);
    material.unit = MaterialUnit::Kg;
    material.price = dec!(29.9);
    material
        .properties
        .insert("Temperatur".to_string(), "240 °C".to_string());
    material
}

/// Erzeugt einen Maschinenstundensatz mit vollständigen Feldern.
fn test_hourly_rate() -> HourlyRate {
    let mut rate = HourlyRate::new("Büro-Drucker");
    rate.time_basis = TimeBasis::PerYear;
    rate.machine_hours = dec!(1200);
    rate.replacement_cost = dec!(1499);
    rate.service_life_years = dec!(4);
    rate.interest_rate_percent = dec!(3);
    rate.maintenance_fixed = dec!(120);
    rate.rent_fixed = dec!(240);
    rate.electricity_fixed = dec!(60);
    rate.additional_fixed = dec!(0);
    rate.maintenance_variable = dec!(0.5);
    rate.electricity_variable = dec!(0.1);
    rate.additional_variable = dec!(0);
    rate.fixed_rate_override = None;
    rate
}

/// Erzeugt ein Kalkulationsprofil mit vollständigen Feldern.
fn test_profile() -> CalculationProfile {
    CalculationProfile {
        id: Uuid::new_v4(),
        name: "Standard Plus".to_string(),
        fail_rate_percent: dec!(5),
        tax_rate_percent: dec!(19),
        margin_percent: dec!(20),
        handling_fee: dec!(5),
        handling_fee_scope: HandlingFeeScope::Once,
        energy_price_per_kwh: dec!(0.35),
        apply_energy_costs: true,
        power_level_percent: dec!(75),
        combine_materials: false,
        multiply_print_time_with_quantity: true,
        print_time_factor: dec!(1),
        exclude_machine_from_margin: false,
        exclude_material_from_margin: false,
        exclude_worksteps_from_margin: false,
    }
}

/// Erzeugt eine vollständige Kalkulation mit zwei Dateien.
fn test_calculation() -> CalculationInput {
    let mut first = CalculationFileInput::new("Gehäuse.stl", 3, dec!(4.5));
    first.volume_cm3 = Some(dec!(12.4));
    first.materials.push(FileMaterial::new(test_material()));

    let mut second = CalculationFileInput::new("Deckel.stl", 1, dec!(1.25));
    second.volume_cm3 = Some(dec!(3.1));
    second.weight_g = Some(dec!(4.2));
    second.materials.push(FileMaterial::new(test_material()));

    let mut calculation = CalculationInput::new("Gehäuse-Serie", test_printer());
    calculation.notes = Some("Testkalkulation".to_string());
    calculation.profile = test_profile();
    calculation.hourly_rate = Some(test_hourly_rate());
    calculation.files = vec![first, second];
    calculation
}

// ---------------------------------------------------------------------------
// Drucker
// ---------------------------------------------------------------------------

#[test]
fn ueberlaufendes_bauvolumen_wird_statt_eines_panics_abgelehnt() {
    let store = SqliteStore::open_in_memory().expect("In-Memory-SQLite muss öffnen");
    let mut printer = test_printer();
    printer.build_width_mm = Decimal::MAX;
    printer.build_depth_mm = dec!(2);
    printer.build_height_mm = dec!(2);

    let result = std::panic::catch_unwind(|| store.save_printer(&printer));
    assert!(result.is_ok(), "save_printer darf nicht panicen");
    assert!(
        matches!(result.unwrap(), Err(StoreError::InvalidValue { .. })),
        "Überlauf muss als InvalidValue gemeldet werden"
    );
}

#[test]
fn drucker_legen_sich_an_und_lassen_sich_lesen() {
    for_each_backend(|store| {
        let printer = test_printer();
        store
            .save_printer(&printer)
            .expect("Speichern muss klappen");

        let loaded = store.get_printer(printer.id).expect("Lesen muss klappen");
        assert_eq!(loaded, printer);
        assert_eq!(store.list_printers().unwrap().len(), 1);
    });
}

#[test]
fn drucker_speichern_alle_felder_exakt() {
    for_each_backend(|store| {
        let printer = test_printer();
        store.save_printer(&printer).unwrap();

        let loaded = store.get_printer(printer.id).unwrap();
        assert_eq!(loaded.model, "Prusa MK4S");
        assert_eq!(loaded.manufacturer.as_deref(), Some("Prusa Research"));
        assert_eq!(loaded.process, PrintProcess::Fdm);
        assert_eq!(loaded.power_watts, dec!(110));
        assert_eq!(loaded.build_width_mm, dec!(250));
        assert_eq!(loaded.build_depth_mm, dec!(210));
        assert_eq!(loaded.build_height_mm, dec!(220));
        assert_eq!(loaded.build_volume_mm3().unwrap(), dec!(11_550_000));
        assert_eq!(loaded.purchase_price, dec!(1499));
        assert_eq!(loaded.hourly_rate, Some(dec!(12.5)));
        assert_eq!(loaded.nozzle_wear_cost, Some(dec!(4.5)));
        assert_eq!(loaded.build_plate_wear_cost, Some(dec!(19.9)));
        assert_eq!(loaded.material_change_cost, Some(dec!(2)));
        assert_eq!(
            loaded
                .properties
                .get("Düsendurchmesser")
                .map(String::as_str),
            Some("0,4 mm")
        );
    });
}

#[test]
fn drucker_werden_aktualisiert_nicht_verdoppelt() {
    for_each_backend(|store| {
        let mut printer = test_printer();
        store.save_printer(&printer).unwrap();

        printer.model = "Prusa MK4S (2026)".to_string();
        printer.hourly_rate = Some(dec!(14));
        store.save_printer(&printer).unwrap();

        let printers = store.list_printers().unwrap();
        assert_eq!(printers.len(), 1);
        assert_eq!(printers[0].model, "Prusa MK4S (2026)");
        assert_eq!(printers[0].hourly_rate, Some(dec!(14)));
    });
}

#[test]
fn unbekannter_drucker_ergibt_not_found() {
    for_each_backend(|store| {
        let id = Uuid::new_v4();
        let error = store.get_printer(id).expect_err("muss fehlschlagen");
        assert!(matches!(
            error,
            StoreError::NotFound {
                entity: "Drucker",
                ..
            }
        ));
    });
}

#[test]
fn loeschen_eines_unbekannten_drucks_ergibt_not_found() {
    for_each_backend(|store| {
        let id = Uuid::new_v4();
        let error = store.delete_printer(id).expect_err("muss fehlschlagen");
        assert!(matches!(error, StoreError::NotFound { .. }));
    });
}

#[test]
fn drucker_koennen_geloescht_werden() {
    for_each_backend(|store| {
        let printer = test_printer();
        store.save_printer(&printer).unwrap();
        store.delete_printer(printer.id).unwrap();
        assert!(store.list_printers().unwrap().is_empty());
    });
}

#[test]
fn drucker_werden_nach_modell_sortiert() {
    for_each_backend(|store| {
        for model in ["Zebra", "Alpha", "Mike"] {
            store
                .save_printer(&Printer::new(model, PrintProcess::Fdm))
                .unwrap();
        }
        let models: Vec<String> = store
            .list_printers()
            .unwrap()
            .into_iter()
            .map(|printer| printer.model)
            .collect();
        assert_eq!(models, vec!["Alpha", "Mike", "Zebra"]);
    });
}

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

#[test]
fn material_legen_sich_an_und_lassen_sich_lesen() {
    for_each_backend(|store| {
        let material = test_material();
        store.save_material(&material).unwrap();

        let loaded = store.get_material(material.id).unwrap();
        assert_eq!(loaded, material);
        assert_eq!(loaded.unit, MaterialUnit::Kg);
        assert_eq!(loaded.density_g_cm3, dec!(1.27));
        assert_eq!(loaded.price, dec!(29.9));
    });
}

#[test]
fn material_preise_bleiben_exakt() {
    for_each_backend(|store| {
        let mut material = test_material();
        material.price = dec!(0.123456789);
        store.save_material(&material).unwrap();

        let loaded = store.get_material(material.id).unwrap();
        assert_eq!(loaded.price, dec!(0.123456789));
    });
}

#[test]
fn material_kann_geloescht_werden() {
    for_each_backend(|store| {
        let material = test_material();
        store.save_material(&material).unwrap();
        store.delete_material(material.id).unwrap();
        assert!(store.list_materials().unwrap().is_empty());
    });
}

// ---------------------------------------------------------------------------
// Arbeitsschritte und Kategorien
// ---------------------------------------------------------------------------

#[test]
fn arbeitsschritte_legen_sich_an_und_lassen_sich_lesen() {
    for_each_backend(|store| {
        let mut category = WorkstepCategory::new("Nachbearbeitung");
        category.color = Some("#ff8800".to_string());
        store.save_workstep_category(&category).unwrap();

        let mut workstep = Workstep::new(
            "Entstutzung",
            category.clone(),
            WorkstepCalculationType::PerPiece,
            dec!(0.5),
        );
        workstep.quantity = dec!(1);
        workstep.duration_hours = dec!(0.25);
        workstep.timing = WorkstepTiming::After;
        store.save_workstep(&workstep).unwrap();

        let loaded = store.get_workstep(workstep.id).unwrap();
        assert_eq!(loaded.name, "Entstutzung");
        assert_eq!(loaded.price, dec!(0.5));
        assert_eq!(loaded.duration_hours, dec!(0.25));
        assert_eq!(loaded.timing, WorkstepTiming::After);
        assert_eq!(loaded.calculation_type, WorkstepCalculationType::PerPiece);
        assert_eq!(loaded.category.id, category.id);
        assert_eq!(loaded.category.name, "Nachbearbeitung");
        assert_eq!(loaded.category.color.as_deref(), Some("#ff8800"));
    });
}

#[test]
fn arbeitsschritt_mit_unbekannter_kategorie_wird_abgelehnt() {
    for_each_backend(|store| {
        let workstep = Workstep::new(
            "Waisenkind",
            WorkstepCategory::new("Unbekannt"),
            WorkstepCalculationType::PerPiece,
            dec!(1),
        );
        let error = store
            .save_workstep(&workstep)
            .expect_err("muss fehlschlagen");
        assert!(matches!(error, StoreError::NotFound { .. }));
    });
}

#[test]
fn benutzte_kategorie_kann_nicht_geloescht_werden() {
    for_each_backend(|store| {
        let category = WorkstepCategory::new("Nachbearbeitung");
        store.save_workstep_category(&category).unwrap();

        let workstep = Workstep::new(
            "Entstutzung",
            category.clone(),
            WorkstepCalculationType::PerPiece,
            dec!(0.5),
        );
        store.save_workstep(&workstep).unwrap();

        let error = store
            .delete_workstep_category(category.id)
            .expect_err("muss fehlschlagen");
        assert!(matches!(error, StoreError::InUse { .. }));
    });
}

#[test]
fn unbenutzte_kategorie_kann_geloescht_werden() {
    for_each_backend(|store| {
        let category = WorkstepCategory::new("Vorbereitung");
        store.save_workstep_category(&category).unwrap();
        store.delete_workstep_category(category.id).unwrap();
        assert!(store.list_workstep_categories().unwrap().is_empty());
    });
}

// ---------------------------------------------------------------------------
// Stundensätze und Profile
// ---------------------------------------------------------------------------

#[test]
fn stundensaetze_lassen_sich_speichern_und_lesen() {
    for_each_backend(|store| {
        let rate = test_hourly_rate();
        store.save_hourly_rate(&rate).unwrap();

        let loaded = store.get_hourly_rate(rate.id).unwrap();
        assert_eq!(loaded, rate);
        assert_eq!(loaded.time_basis, TimeBasis::PerYear);
        assert_eq!(loaded.fixed_rate_override, None);
    });
}

#[test]
fn profile_lassen_sich_speichern_und_lesen() {
    for_each_backend(|store| {
        let profile = test_profile();
        store.save_calculation_profile(&profile).unwrap();

        let loaded = store.get_calculation_profile(profile.id).unwrap();
        assert_eq!(loaded, profile);
        assert!(loaded.apply_energy_costs);
        assert!(loaded.multiply_print_time_with_quantity);
        assert_eq!(loaded.handling_fee_scope, HandlingFeeScope::Once);
    });
}

#[test]
fn profile_kann_geloescht_werden() {
    for_each_backend(|store| {
        let profile = test_profile();
        store.save_calculation_profile(&profile).unwrap();
        store.delete_calculation_profile(profile.id).unwrap();
        assert!(store.list_calculation_profiles().unwrap().is_empty());
    });
}

// ---------------------------------------------------------------------------
// Kalkulationen
// ---------------------------------------------------------------------------

#[test]
fn gleiche_datei_id_in_zwei_kalkulationen_ist_erlaubt() {
    for_each_backend(|store| {
        let first = test_calculation();
        let shared_file_id = first.files[0].id;
        let mut second = test_calculation();
        second.id = Uuid::new_v4();
        second.project_name = "Zweite Kalkulation".to_string();
        second.files[0].id = shared_file_id;

        store.save_calculation(&first).expect("erste Kalkulation");
        store.save_calculation(&second).expect("zweite Kalkulation");
        assert_eq!(store.list_calculations().unwrap().len(), 2);
    });
}

#[test]
fn doppelte_datei_id_in_einer_kalkulation_ist_ein_fehler() {
    for_each_backend(|store| {
        let mut calculation = test_calculation();
        calculation.files[1].id = calculation.files[0].id;
        assert!(matches!(
            store.save_calculation(&calculation),
            Err(StoreError::InvalidValue { .. })
        ));
    });
}

#[test]
fn kalkulation_wird_als_schnappschuss_gespeichert() {
    for_each_backend(|store| {
        let calculation = test_calculation();
        store.save_calculation(&calculation).unwrap();

        let loaded = store.get_calculation(calculation.id).unwrap();
        assert_eq!(loaded.document, calculation);
        assert_eq!(loaded.project_name, "Gehäuse-Serie");
        assert_eq!(loaded.document.files.len(), 2);
    });
}

#[test]
fn kalkulation_bleibt_unveraendert_wenn_stammdaten_geaendert_werden() {
    for_each_backend(|store| {
        let mut calculation = test_calculation();

        // Material in der Kalkulation ist ein Schnappschuss.
        let mut snapshot_material = test_material();
        snapshot_material.price = dec!(29.9);
        calculation.files[0].materials[0].material = snapshot_material.clone();

        store.save_calculation(&calculation).unwrap();

        // Das Stammdaten-Material wird danach geändert.
        let mut master = snapshot_material.clone();
        master.price = dec!(99.9);
        store.save_material(&master).unwrap();

        let loaded = store.get_calculation(calculation.id).unwrap();
        assert_eq!(
            loaded.document.files[0].materials[0].material.price,
            dec!(29.9)
        );
    });
}

#[test]
fn kalkulationsliste_zeigt_datei_und_stueckzahlen() {
    for_each_backend(|store| {
        let calculation = test_calculation();
        store.save_calculation(&calculation).unwrap();

        let summaries = store.list_calculations().unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].project_name, "Gehäuse-Serie");
        assert_eq!(summaries[0].file_count, 2);
        assert_eq!(summaries[0].total_quantity, 4);
    });
}

#[test]
fn kalkulation_kann_aktualisiert_werden_ohne_doppelten_eintrag() {
    for_each_backend(|store| {
        let mut calculation = test_calculation();
        store.save_calculation(&calculation).unwrap();

        calculation.project_name = "Gehäuse-Serie v2".to_string();
        calculation.files.pop();
        store.save_calculation(&calculation).unwrap();

        let summaries = store.list_calculations().unwrap();
        assert_eq!(summaries.len(), 1);
        assert_eq!(summaries[0].project_name, "Gehäuse-Serie v2");
        assert_eq!(summaries[0].file_count, 1);
        assert_eq!(summaries[0].total_quantity, 3);
    });
}

#[test]
fn unbekannte_kalkulation_ergibt_not_found() {
    for_each_backend(|store| {
        let id = Uuid::new_v4();
        let error = store.get_calculation(id).expect_err("muss fehlschlagen");
        assert!(matches!(error, StoreError::NotFound { .. }));

        let error = store.delete_calculation(id).expect_err("muss fehlschlagen");
        assert!(matches!(error, StoreError::NotFound { .. }));
    });
}

#[test]
fn kalkulation_kann_geloescht_werden() {
    for_each_backend(|store| {
        let calculation = test_calculation();
        store.save_calculation(&calculation).unwrap();
        store.delete_calculation(calculation.id).unwrap();
        assert!(store.list_calculations().unwrap().is_empty());
    });
}

#[test]
fn gespeicherte_kalkulation_bleibt_auch_nach_neuoeffnen_erhalten() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("openprintcost.db");

    let calculation = test_calculation();
    {
        let store = SqliteStore::open(&path).unwrap();
        store.save_calculation(&calculation).unwrap();
        store.save_printer(&test_printer()).unwrap();
    }

    // Datenbank schließen und neu öffnen.
    let store = SqliteStore::open(&path).unwrap();
    let loaded = store.get_calculation(calculation.id).unwrap();
    assert_eq!(loaded.document, calculation);
    assert_eq!(store.list_printers().unwrap().len(), 1);
}

#[test]
fn migrationen_werden_nicht_doppelt_angewandt() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("openprintcost.db");

    {
        let store = SqliteStore::open(&path).unwrap();
        store.save_printer(&test_printer()).unwrap();
    }
    {
        // Zweites Öffnen: die Migration darf nicht erneut laufen.
        let store = SqliteStore::open(&path).unwrap();
        assert_eq!(store.list_printers().unwrap().len(), 1);
    }
}

#[test]
fn destruktive_migration_legt_vorher_ein_backup_an() {
    use opc_store::sqlite::migrations::MIGRATIONS;
    use rusqlite::{Connection, params};

    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("openprintcost.db");

    {
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE schema_migrations (
                     version    INTEGER PRIMARY KEY NOT NULL,
                     name       TEXT NOT NULL,
                     applied_at TEXT NOT NULL
                 );",
            )
            .unwrap();
        for migration in MIGRATIONS.iter().filter(|migration| migration.version <= 4) {
            connection.execute_batch(migration.sql).unwrap();
            connection
                .execute(
                    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
                    params![migration.version, migration.name, "2026-01-01T00:00:00Z"],
                )
                .unwrap();
        }
        connection
            .execute(
                "INSERT INTO calculations (id, project_name, notes, created_at, updated_at, document)
                 VALUES ('calc', 'Alt', NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '{}')",
                [],
            )
            .unwrap();
        connection
            .execute(
                "INSERT INTO calculation_files
                 (id, calculation_id, file_name, quantity, print_time_hours, volume_cm3, weight_g, material_changes, sort_order)
                 VALUES ('file', 'calc', 'alt.stl', 1, '2', NULL, NULL, 0, 0)",
                [],
            )
            .unwrap();
    }

    let _store = SqliteStore::open(&path).expect("Migration muss laufen");

    let backup = std::fs::read_dir(directory.path())
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|entry| {
            entry
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.contains(".backup-v5-"))
        })
        .expect("Backup vor Migration 0005 fehlt");

    let backup_connection = Connection::open(backup).unwrap();
    let files: i64 = backup_connection
        .query_row("SELECT COUNT(*) FROM calculation_files", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(files, 1, "Backup muss die alten Dateien enthalten");
    let version: i64 = backup_connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(version, 4, "Backup muss den Stand vor Migration 0005 haben");
}

#[test]
fn datenbank_mit_hoeherer_version_wird_abgelehnt() {
    use rusqlite::Connection;

    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("future.db");

    {
        // Simuliert eine Datenbank aus einer neueren Version.
        let connection = Connection::open(&path).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE schema_migrations (
                     version    INTEGER PRIMARY KEY NOT NULL,
                     name       TEXT NOT NULL,
                     applied_at TEXT NOT NULL
                 );
                 INSERT INTO schema_migrations (version, name, applied_at)
                 VALUES (9999, 'aus_der_zukunft', '2099-01-01T00:00:00Z');",
            )
            .unwrap();
    }

    let error = SqliteStore::open(&path).expect_err("muss fehlschlagen");
    assert!(matches!(
        error,
        StoreError::SchemaTooNew { found: 9999, .. }
    ));
}

#[test]
fn firmendaten_runden_sich_ueber_beide_adapter() {
    for_each_backend(|store| {
        // Anfangs leer, kein Fehler.
        let initial = store.get_company_info().unwrap();
        assert_eq!(initial.name, "");
        assert_eq!(initial.email, "");
        // Neue Installationen starten in US-Dollar; bestehende Vor-Währungs-
        // Datenbanken behalten durch Migration 0004 den damaligen Euro-Standard.
        assert_eq!(initial.currency, "USD");

        store
            .save_company_info(&opc_store::CompanyInfo {
                name: "Muster GmbH".to_string(),
                street: "Druckweg 1".to_string(),
                zip_city: "12345 Beispielstadt".to_string(),
                email: "info@example.invalid".to_string(),
                currency: "EUR".to_string(),
            })
            .unwrap();

        let loaded = store.get_company_info().unwrap();
        assert_eq!(loaded.name, "Muster GmbH");
        assert_eq!(loaded.zip_city, "12345 Beispielstadt");

        // Überschreiben ersetzt vollständig.
        store
            .save_company_info(&opc_store::CompanyInfo {
                name: "Neu".to_string(),
                street: "".to_string(),
                zip_city: "".to_string(),
                email: "".to_string(),
                currency: "USD".to_string(),
            })
            .unwrap();
        let reloaded = store.get_company_info().unwrap();
        assert_eq!(reloaded.name, "Neu");
        assert_eq!(reloaded.currency, "USD");
    });
}

// ---------------------------------------------------------------------------
// Vertragsprüfung
// ---------------------------------------------------------------------------

#[test]
fn ids_sind_uuid_v4() {
    for_each_backend(|store| {
        let printer = test_printer();
        store.save_printer(&printer).unwrap();
        assert_eq!(printer.id.get_version_num(), 4);
    });
}

#[test]
fn alle_adapter_erfuellen_den_port() {
    // Statische Prüfung: beide Adapter sind `Store`.
    fn assert_store<T: Store>() {}
    assert_store::<MemoryStore>();
    assert_store::<SqliteStore>();
}

#[test]
fn geldbetraege_werden_nicht_als_flieskommazahl_gespeichert() {
    // Ein Betrag, den ein `f64` nicht exakt darstellen kann.
    let mut material = test_material();
    material.price = dec!(0.1) + dec!(0.2);

    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("praezision.db");

    let store = SqliteStore::open(&path).unwrap();
    store.save_material(&material).unwrap();
    drop(store);

    // Rohwert aus der Datenbank lesen.
    let connection = rusqlite::Connection::open(&path).unwrap();
    let raw: String = connection
        .query_row(
            "SELECT price FROM materials WHERE id = ?1",
            [material.id.to_string()],
            |row| row.get(0),
        )
        .unwrap();

    assert_eq!(raw, "0.3");
    let parsed: Decimal = raw.parse().unwrap();
    assert_eq!(parsed, dec!(0.1) + dec!(0.2));
}
