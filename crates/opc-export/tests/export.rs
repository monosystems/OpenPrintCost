//! Integrationstests des Exports.
//!
//! PDF wird auf Magic-Bytes und Inhalt geprüft, Excel per Roundtrip mit
//! `calamine` zurückgelesen (Blätter, Positionen, Summen, Zahlentypen).

use calamine::{Data, Reader, Xlsx};
use opc_core::calc::calculate;
use opc_core::model::{
    CalculationFileInput, CalculationInput, CalculationProfile, FileMaterial, Material, Printer,
};
use opc_export::{
    CompanyInfo, ExportError, ExportLocale, render_excel, render_excel_with_locale, render_pdf,
    render_pdf_with_locale,
};
use rust_decimal_macros::dec;
use std::io::Cursor;

/// Eine durchgerechnete Minimal-Kalkulation als Fixture.
fn fixture_result() -> opc_core::model::CalculationResult {
    let mut material = Material::new("PLA", "PLA");
    material.price = dec!(25);
    material.density_g_cm3 = dec!(1.24);

    let mut file = CalculationFileInput::new("Würfel.stl", 1, dec!(2));
    file.volume_cm3 = Some(dec!(10));
    file.dimensions_mm = Some([dec!(20), dec!(20), dec!(20)]);
    file.materials.push(FileMaterial::new(material));

    let mut printer = Printer::new("Export-Drucker", opc_core::model::PrintProcess::Fdm);
    printer.power_watts = dec!(100);
    printer.hourly_rate = Some(dec!(25));
    printer.build_width_mm = dec!(250);
    printer.build_depth_mm = dec!(210);
    printer.build_height_mm = dec!(220);

    let mut input = CalculationInput::new("Exportprojekt", printer);
    input.profile = CalculationProfile {
        energy_price_per_kwh: dec!(0.35),
        apply_energy_costs: true,
        margin_percent: dec!(20),
        tax_rate_percent: dec!(19),
        ..CalculationProfile::default()
    };
    input.files.push(file);

    calculate(&input).expect("Fixture muss durchrechnen")
}

#[test]
fn pdf_beginnt_mit_magic_und_enthaelt_den_projektnamen() {
    let result = fixture_result();
    let pdf = render_pdf(&result, &CompanyInfo::default()).expect("PDF muss erzeugen");

    assert!(pdf.starts_with(b"%PDF"), "PDF-Magic fehlt");
    assert!(!pdf.is_empty());

    // Rückweg über den Parser: Der Text muss extrahierbar sein.
    let text = extract_pdf_text(&pdf);
    assert!(
        text.contains("Exportprojekt"),
        "Projektname fehlt im PDF-Text: {text}"
    );
    assert!(
        text.contains("Verkaufspreis"),
        "Gruppe fehlt im PDF-Text: {text}"
    );
    assert!(
        text.contains("Preis je Stück"),
        "Stückpreis fehlt im PDF-Text: {text}"
    );
    assert!(
        text.contains("20,00 × 20,00 × 20,00 mm"),
        "Dateimaße fehlen im PDF-Text: {text}"
    );
}

#[test]
fn pdf_zeigt_firmendaten_wenn_vorhanden() {
    let result = fixture_result();
    let company = CompanyInfo {
        name: "Muster GmbH".to_string(),
        street: "Druckweg 1".to_string(),
        zip_city: "12345 Beispielstadt".to_string(),
        email: "info@example.invalid".to_string(),
        currency: "EUR".to_string(),
    };
    let pdf = render_pdf(&result, &company).expect("PDF muss erzeugen");

    let text = extract_pdf_text(&pdf);
    assert!(
        text.contains("Muster GmbH"),
        "Firmenname fehlt im PDF-Text: {text}"
    );
}

/// Parst ein PDF zurück und gibt den extrahierten Text aller Seiten zurück.
fn extract_pdf_text(pdf: &[u8]) -> String {
    use printpdf::{PdfDocument, PdfParseErrorSeverity, PdfParseOptions, PdfWarnMsg};

    let mut warnings: Vec<PdfWarnMsg> = Vec::new();
    let document =
        PdfDocument::parse(pdf, &PdfParseOptions::default(), &mut warnings).expect("muss parsen");
    warnings.retain(|warning| !matches!(warning.severity, PdfParseErrorSeverity::Info));
    assert!(warnings.is_empty(), "unerwartete Warnungen: {warnings:?}");
    document
        .extract_text()
        .iter()
        .flat_map(|page| page.iter().cloned())
        .collect::<Vec<_>>()
        .join("\n")
}

#[test]
fn excel_enthaelt_notizen_und_dateizuordnung() {
    let mut result = fixture_result();
    result.notes = Some("Bitte vor dem Versand prüfen.".to_string());
    let bytes = render_excel(&result, &CompanyInfo::default()).expect("Excel muss erzeugen");
    let mut excel: Xlsx<_> = Reader::new(Cursor::new(bytes)).expect("muss lesbar sein");

    let overview = excel
        .worksheet_range("Übersicht")
        .expect("Blatt muss lesbar sein");
    assert!(
        overview.rows().any(
            |row| row.first() == Some(&Data::String("Notizen".to_string()))
                && row.get(1) == Some(&Data::String("Bitte vor dem Versand prüfen.".to_string()))
        ),
        "Notizen fehlen"
    );
}

#[test]
fn pdf_enthaelt_notizen_dateizuordnung_und_seitenzahl() {
    let mut result = fixture_result();
    result.notes = Some("Bitte vor dem Versand prüfen.".to_string());
    result.project_name = "Sehr langes Projekt mit einem Namen, der umgebrochen werden muss, damit er nicht über den rechten Rand läuft".to_string();

    let pdf = render_pdf(&result, &CompanyInfo::default()).expect("PDF muss erzeugen");
    let text = extract_pdf_text(&pdf);

    assert!(
        text.contains("Notizen: Bitte vor dem Versand prüfen."),
        "{text}"
    );
    assert!(
        text.contains("Würfel.stl — PLA"),
        "Dateizuordnung fehlt: {text}"
    );
    assert!(text.contains("Seite 1"), "Seitenzahl fehlt: {text}");
}

#[test]
fn pdf_verteilt_viele_positionen_mit_seitenzahlen() {
    let mut result = fixture_result();
    let template = result.positions[0].clone();
    for index in 0..80 {
        let mut position = template.clone();
        position.label = format!("Position {index}");
        result.positions.push(position);
    }

    let pdf = render_pdf(&result, &CompanyInfo::default()).expect("PDF muss erzeugen");
    let text = extract_pdf_text(&pdf);
    assert!(text.contains("Seite 1"), "{text}");
    assert!(text.contains("Seite 2"), "{text}");
}

#[test]
fn leeres_ergebnis_ist_ein_fehler() {
    let mut result = fixture_result();
    result.positions.clear();

    assert_eq!(
        render_pdf(&result, &CompanyInfo::default()).expect_err("muss fehlschlagen"),
        ExportError::Empty
    );
    assert_eq!(
        render_excel(&result, &CompanyInfo::default()).expect_err("muss fehlschlagen"),
        ExportError::Empty
    );
}

#[test]
fn excel_roundtrip_liest_blaetter_positionen_und_summen() {
    let result = fixture_result();
    let bytes = render_excel(&result, &CompanyInfo::default()).expect("Excel muss erzeugen");

    // XLSX ist ein ZIP-Archiv.
    assert!(bytes.starts_with(b"PK"), "XLSX-Magic fehlt");

    let mut excel: Xlsx<_> = Reader::new(Cursor::new(bytes)).expect("muss lesbar sein");
    let sheets = excel.sheet_names();
    assert!(
        sheets.contains(&"Übersicht".to_string()),
        "Blatt Übersicht fehlt: {sheets:?}"
    );
    assert!(
        sheets.contains(&"Positionen".to_string()),
        "Blatt Positionen fehlt"
    );
    assert!(
        sheets.contains(&"Dateien".to_string()),
        "Blatt Dateien fehlt"
    );

    // Übersicht: Gesamt steht als Zahl in der letzten Summenzeile.
    let overview = excel
        .worksheet_range("Übersicht")
        .expect("Blatt muss lesbar sein");
    let total_row = overview
        .rows()
        .position(|row| row.first() == Some(&Data::String("Verkaufspreis ($)".to_string())))
        .expect("Verkaufspreis-Zeile fehlt");
    let total = overview
        .get((total_row, 1))
        .expect("Verkaufspreis-Wert fehlt");
    assert!(
        matches!(total, Data::Float(_)),
        "Verkaufspreis muss eine Zahl sein, keine Formel: {total:?}"
    );
    if let Data::Float(value) = total {
        let expected: f64 = result.total.to_string().parse().unwrap();
        assert!(
            (value - expected).abs() < 0.01,
            "Verkaufspreis weicht ab: {value} vs {expected}"
        );
    }

    let per_piece_row = overview
        .rows()
        .position(|row| row.first() == Some(&Data::String("Preis je Stück ($)".to_string())))
        .expect("Stückpreis-Zeile fehlt");
    assert!(
        matches!(overview.get((per_piece_row, 1)), Some(Data::Float(_))),
        "Stückpreis muss eine Zahl sein"
    );

    // Positionen: jede Betrags-Zelle ist eine Zahl (keine Formel).
    let positions = excel
        .worksheet_range("Positionen")
        .expect("Blatt muss lesbar sein");
    let amounts: Vec<_> = positions.rows().skip(1).map(|row| row[6].clone()).collect();
    assert!(!amounts.is_empty(), "keine Positionen exportiert");
    for amount in &amounts {
        assert!(
            matches!(amount, Data::Float(_)),
            "Betrag muss eine Zahl sein: {amount:?}"
        );
    }
    // Erste Position ist das Material der Fixture: 12,4 g × 0,025 €/g = 0,31 €.
    assert!(matches!(amounts[0], Data::Float(value) if (value - 0.31).abs() < 0.001));
    assert_eq!(
        positions.get((1, 1)),
        Some(&Data::String("Würfel.stl".to_string()))
    );

    // Dateien: eine Zeile mit Stückzahl 1 als Zahl.
    let files = excel
        .worksheet_range("Dateien")
        .expect("Blatt muss lesbar sein");
    assert_eq!(
        files.get((1, 0)),
        Some(&Data::String("Würfel.stl".to_string()))
    );
    assert_eq!(files.get((1, 1)), Some(&Data::Float(1.0)));
    assert_eq!(
        files.get((1, 6)),
        Some(&Data::String("20,00 × 20,00 × 20,00".to_string()))
    );
    assert_eq!(files.get((1, 7)), Some(&Data::String("ja".to_string())));
}

#[test]
fn pdf_und_excel_lassen_sich_auf_englisch_erzeugen() {
    let mut result = fixture_result();
    result.notes = Some("Check before shipping.".to_string());

    let pdf = render_pdf_with_locale(&result, &CompanyInfo::default(), ExportLocale::En)
        .expect("PDF muss erzeugen");
    let text = extract_pdf_text(&pdf);
    assert!(text.contains("Selling price"), "{text}");
    assert!(text.contains("Page 1"), "{text}");
    assert!(text.contains("Notes: Check before shipping."), "{text}");
    assert!(text.contains("Machine costs —"), "{text}");
    assert!(!text.contains("Maschinenkosten"), "{text}");
    assert!(text.contains("0.31"), "{text}");
    assert!(!text.contains("Projekt:"), "{text}");

    let bytes = render_excel_with_locale(&result, &CompanyInfo::default(), ExportLocale::En)
        .expect("Excel muss erzeugen");
    let mut excel: Xlsx<_> = Reader::new(Cursor::new(bytes)).expect("muss lesbar sein");
    let sheets = excel.sheet_names();
    assert!(sheets.contains(&"Overview".to_string()), "{sheets:?}");
    assert!(sheets.contains(&"Positions".to_string()), "{sheets:?}");
    assert!(sheets.contains(&"Files".to_string()), "{sheets:?}");

    let overview = excel
        .worksheet_range("Overview")
        .expect("Blatt muss lesbar sein");
    assert!(
        overview
            .rows()
            .any(|row| row.first() == Some(&Data::String("Selling price ($)".to_string()))),
        "englische Summenzeile fehlt"
    );
}

#[test]
fn pdf_stellt_cjk_texte_dar() {
    let mut result = fixture_result();
    result.project_name = "中文测试".to_string();
    if let Some(position) = result.positions.first_mut() {
        position.label = "测试材料".to_string();
    }

    let pdf = render_pdf_with_locale(&result, &CompanyInfo::default(), ExportLocale::En)
        .expect("PDF muss erzeugen");
    let text = extract_pdf_text(&pdf);
    assert!(text.contains("中文测试"), "CJK-Projektname fehlt: {text}");
    assert!(text.contains("测试材料"), "CJK-Materialname fehlt: {text}");
}
