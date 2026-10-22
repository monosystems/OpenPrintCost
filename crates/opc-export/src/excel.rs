//! Excel-Arbeitsmappe einer Kalkulation.
//!
//! Drei Blätter: `Übersicht` (Kopfdaten + Summen), `Positionen` (alle
//! Positionen mit Gruppe, Menge und Betrag) und `Dateien` (Mengengerüste).
//! Alle Beträge stehen als **Zahlen**, nicht als Formeln (Spec 0001,
//! Abschnitt 7).

use crate::error::{ExportError, ExportResult};
use opc_core::model::{CalculationResult, CostGroup};
use rust_decimal::prelude::ToPrimitive;
use rust_xlsxwriter::{Format, Workbook};

/// Schreibt eine Zelle und wandelt Fehler in `ExportError::Excel` um.
macro_rules! w {
    ($sheet:expr, $call:ident($($arg:expr),* $(,)?)) => {
        $sheet.$call($($arg),*).map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    };
}

/// Deutsche Gruppennamen.
fn group_label(group: CostGroup) -> &'static str {
    match group {
        CostGroup::Material => "Material",
        CostGroup::Machine => "Maschinenkosten",
        CostGroup::Energy => "Energiekosten",
        CostGroup::ProcessSurcharge => "Verfahrenszuschläge",
        CostGroup::Worksteps => "Arbeitsschritte",
        CostGroup::AdditionalItems => "Zusatzartikel",
        CostGroup::HandlingFee => "Handlungspauschale",
        CostGroup::CustomSurcharge => "Zuschläge",
        CostGroup::Margin => "Gewinnmarge",
        CostGroup::Tax => "Steuer",
        CostGroup::Total => "Gesamtkosten",
    }
}

/// Wandelt einen `Decimal`-Betrag in eine Excel-Zahl um.
///
/// Der Export ist Darstellung — die exakte Rechnung bleibt in `opc-core`.
/// Nicht darstellbare Werte werden als 0 geschrieben, nie abgebrochen.
fn number(value: rust_decimal::Decimal) -> f64 {
    value.to_f64().unwrap_or(0.0)
}

/// Erzeugt die Arbeitsmappe als Byte-Folge.
///
/// Pure Funktion: Ergebnis hinein, Bytes heraus — kein IO, kein Clock.
pub fn render_excel(
    result: &CalculationResult,
    company: &crate::CompanyInfo,
) -> ExportResult<Vec<u8>> {
    if result.positions.is_empty() {
        return Err(ExportError::Empty);
    }

    let mut workbook = Workbook::new();
    let bold = Format::new().set_bold();

    // --- Übersicht -----------------------------------------------------------
    let overview = workbook.add_worksheet();
    overview
        .set_name("Übersicht")
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    let mut row = 0u32;
    w!(overview, write_string(row, 0, "Projekt"));
    w!(overview, write_string(row, 1, &result.project_name));
    row += 1;
    if let Some(created) = &result.created_at {
        w!(overview, write_string(row, 0, "Erstellt"));
        w!(overview, write_string(row, 1, created));
        row += 1;
    }
    if !company.name.trim().is_empty() {
        w!(overview, write_string(row, 0, "Firma"));
        w!(overview, write_string(row, 1, company.name.trim()));
        row += 1;
    }
    w!(overview, write_string(row, 0, "Maschinenstundensatz (€/h)"));
    w!(
        overview,
        write_number(row, 1, number(result.machine_hour_rate))
    );
    row += 2;

    for (key, amount) in [
        ("Basis (€)", result.base_total),
        ("Marge (€)", result.margin_total),
        ("Steuer (€)", result.tax_total),
        ("Gesamt (€)", result.total),
    ] {
        let is_total = key.starts_with("Gesamt");
        w!(overview, write_string_with_format(row, 0, key, &bold));
        if is_total {
            w!(
                overview,
                write_number_with_format(row, 1, number(amount), &bold)
            );
        } else {
            w!(overview, write_number(row, 1, number(amount)));
        }
        row += 1;
    }

    // --- Positionen ----------------------------------------------------------
    let positions = workbook.add_worksheet();
    positions
        .set_name("Positionen")
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    for (col, header) in [
        "Gruppe",
        "Bezeichnung",
        "Detail",
        "Menge",
        "Einheit",
        "Betrag (€)",
    ]
    .iter()
    .enumerate()
    {
        w!(
            positions,
            write_string_with_format(0, col as u16, *header, &bold)
        );
    }
    for (index, position) in result.positions.iter().enumerate() {
        let row = index as u32 + 1;
        w!(positions, write_string(row, 0, group_label(position.group)));
        w!(positions, write_string(row, 1, &position.label));
        w!(
            positions,
            write_string(row, 2, position.detail.as_deref().unwrap_or(""))
        );
        w!(
            positions,
            write_string(
                row,
                3,
                &position.quantity.map(|q| q.to_string()).unwrap_or_default()
            )
        );
        w!(
            positions,
            write_string(row, 4, position.unit.as_deref().unwrap_or(""))
        );
        w!(positions, write_number(row, 5, number(position.amount)));
    }

    // --- Dateien ---------------------------------------------------------------
    let files = workbook.add_worksheet();
    files
        .set_name("Dateien")
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    for (col, header) in [
        "Datei",
        "Stückzahl",
        "Druckzeit (h)",
        "Druckzeit Fehler (h)",
        "Material (g)",
        "Material Fehler (g)",
    ]
    .iter()
    .enumerate()
    {
        w!(
            files,
            write_string_with_format(0, col as u16, *header, &bold)
        );
    }
    for (index, file) in result.files.iter().enumerate() {
        let row = index as u32 + 1;
        w!(files, write_string(row, 0, &file.file_name));
        w!(files, write_number(row, 1, f64::from(file.quantity)));
        w!(files, write_number(row, 2, number(file.print_time_hours)));
        w!(
            files,
            write_number(row, 3, number(file.print_time_hours_fail))
        );
        w!(files, write_number(row, 4, number(file.material_g)));
        w!(files, write_number(row, 5, number(file.material_g_fail)));
    }

    workbook
        .save_to_buffer()
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })
}
