//! Excel-Arbeitsmappe einer Kalkulation.
//!
//! Drei Blätter: `Übersicht` (Kopfdaten + Summen), `Positionen` (alle
//! Positionen mit Gruppe, Menge und Betrag) und `Dateien` (Mengengerüste).
//! Alle Beträge stehen als **Zahlen**, nicht als Formeln (Spec 0001,
//! Abschnitt 7).

use crate::ExportLocale;
use crate::error::{ExportError, ExportResult};
use opc_core::model::CalculationResult;
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
    render_excel_with_locale(result, company, ExportLocale::De)
}

/// Erzeugt die Arbeitsmappe in der gewünschten Sprache.
pub fn render_excel_with_locale(
    result: &CalculationResult,
    company: &crate::CompanyInfo,
    locale: ExportLocale,
) -> ExportResult<Vec<u8>> {
    if result.positions.is_empty() {
        return Err(ExportError::Empty);
    }

    let mut workbook = Workbook::new();
    let bold = Format::new().set_bold();

    // --- Übersicht -----------------------------------------------------------
    let overview = workbook.add_worksheet();
    overview
        .set_name(crate::tr(locale, "Übersicht", "Overview"))
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    let mut row = 0u32;
    w!(
        overview,
        write_string(row, 0, crate::tr(locale, "Projekt", "Project"))
    );
    w!(overview, write_string(row, 1, &result.project_name));
    row += 1;
    if let Some(created) = &result.created_at {
        w!(
            overview,
            write_string(row, 0, crate::tr(locale, "Erstellt", "Created"))
        );
        w!(overview, write_string(row, 1, created));
        row += 1;
    }
    if !company.name.trim().is_empty() {
        w!(
            overview,
            write_string(row, 0, crate::tr(locale, "Firma", "Company"))
        );
        w!(overview, write_string(row, 1, company.name.trim()));
        row += 1;
    }
    if let Some(notes) = &result.notes
        && !notes.trim().is_empty()
    {
        w!(
            overview,
            write_string(row, 0, crate::tr(locale, "Notizen", "Notes"))
        );
        w!(overview, write_string(row, 1, notes.trim()));
        row += 1;
    }
    let symbol = crate::currency_symbol(&company.currency);
    w!(
        overview,
        write_string(
            row,
            0,
            &format!(
                "{} ({symbol}/h)",
                crate::tr(locale, "Maschinenstundensatz", "Machine hourly rate")
            )
        )
    );
    w!(
        overview,
        write_number(row, 1, number(result.machine_hour_rate))
    );
    row += 1;
    w!(
        overview,
        write_string(
            row,
            0,
            crate::tr(locale, "Stückzahl gesamt", "Total quantity")
        )
    );
    w!(
        overview,
        write_number(row, 1, f64::from(result.total_quantity))
    );
    row += 2;

    for (key, amount) in [
        (
            format!(
                "{} ({symbol})",
                crate::tr(locale, "Herstellkosten", "Manufacturing costs")
            ),
            result.base_total,
        ),
        (
            format!("{} ({symbol})", crate::tr(locale, "Marge", "Margin")),
            result.margin_total,
        ),
        (
            format!("{} ({symbol})", crate::tr(locale, "Steuer", "Tax")),
            result.tax_total,
        ),
        (
            format!(
                "{} ({symbol})",
                crate::tr(locale, "Verkaufspreis", "Selling price")
            ),
            result.total,
        ),
    ] {
        let is_total = key.starts_with(crate::tr(locale, "Verkaufspreis", "Selling price"));
        w!(
            overview,
            write_string_with_format(row, 0, key.as_str(), &bold)
        );
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
    if let Some(cost_per_piece) = result.cost_per_piece {
        w!(
            overview,
            write_string(
                row,
                0,
                &format!(
                    "{} ({symbol})",
                    crate::tr(locale, "Kosten je Stück", "Cost per piece")
                )
            )
        );
        w!(overview, write_number(row, 1, number(cost_per_piece)));
        row += 1;
    }
    if let Some(price_per_piece) = result.price_per_piece {
        w!(
            overview,
            write_string_with_format(
                row,
                0,
                &format!(
                    "{} ({symbol})",
                    crate::tr(locale, "Preis je Stück", "Price per piece")
                ),
                &bold
            )
        );
        w!(
            overview,
            write_number_with_format(row, 1, number(price_per_piece), &bold)
        );
    }

    // --- Positionen ----------------------------------------------------------
    let positions = workbook.add_worksheet();
    positions
        .set_name(crate::tr(locale, "Positionen", "Positions"))
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    for (col, header) in [
        crate::tr(locale, "Gruppe", "Group").to_string(),
        crate::tr(locale, "Datei", "File").to_string(),
        crate::tr(locale, "Bezeichnung", "Label").to_string(),
        crate::tr(locale, "Detail", "Detail").to_string(),
        crate::tr(locale, "Menge", "Qty").to_string(),
        crate::tr(locale, "Einheit", "Unit").to_string(),
        format!("{} ({symbol})", crate::tr(locale, "Betrag", "Amount")),
    ]
    .iter()
    .enumerate()
    {
        w!(
            positions,
            write_string_with_format(0, col as u16, header.as_str(), &bold)
        );
    }
    for (index, position) in result.positions.iter().enumerate() {
        let row = index as u32 + 1;
        let file_name = position
            .file_id
            .and_then(|file_id| result.files.iter().find(|file| file.file_id == file_id))
            .map(|file| file.file_name.as_str())
            .unwrap_or("");
        w!(
            positions,
            write_string(row, 0, crate::group_label(position.group, locale))
        );
        w!(positions, write_string(row, 1, file_name));
        w!(
            positions,
            write_string(
                row,
                2,
                &crate::localize_position_label(&position.label, locale)
            )
        );
        w!(
            positions,
            write_string(
                row,
                3,
                &position
                    .detail
                    .as_deref()
                    .map(|detail| crate::localize_detail_locale(detail, &company.currency, locale))
                    .unwrap_or_default()
            )
        );
        w!(
            positions,
            write_string(
                row,
                4,
                &position.quantity.map(|q| q.to_string()).unwrap_or_default()
            )
        );
        w!(
            positions,
            write_string(row, 5, position.unit.as_deref().unwrap_or(""))
        );
        w!(positions, write_number(row, 6, number(position.amount)));
    }

    // --- Dateien ---------------------------------------------------------------
    let files = workbook.add_worksheet();
    files
        .set_name(crate::tr(locale, "Dateien", "Files"))
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })?;
    for (col, header) in [
        crate::tr(locale, "Datei", "File"),
        crate::tr(locale, "Stückzahl", "Quantity"),
        crate::tr(locale, "Druckzeit (h)", "Print time (h)"),
        crate::tr(locale, "Druckzeit Fehler (h)", "Fail print time (h)"),
        crate::tr(locale, "Material (g)", "Material (g)"),
        crate::tr(locale, "Material Fehler (g)", "Fail material (g)"),
        crate::tr(locale, "Maße (mm)", "Dimensions (mm)"),
        crate::tr(locale, "Passt ins Bauvolumen", "Fits build volume"),
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
        if let Some(dimensions) = file.dimensions_mm {
            w!(
                files,
                write_string(
                    row,
                    6,
                    format!(
                        "{} × {} × {}",
                        crate::format_number(dimensions[0], 2, locale),
                        crate::format_number(dimensions[1], 2, locale),
                        crate::format_number(dimensions[2], 2, locale)
                    )
                )
            );
        }
        if let Some(fits) = file.fits_build_volume {
            w!(
                files,
                write_string(
                    row,
                    7,
                    crate::tr(
                        locale,
                        if fits { "ja" } else { "nein" },
                        if fits { "yes" } else { "no" }
                    ),
                )
            );
        }
    }

    workbook
        .save_to_buffer()
        .map_err(|error| ExportError::Excel {
            message: error.to_string(),
        })
}
