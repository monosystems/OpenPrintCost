//! PDF-Report einer Kalkulation.
//!
//! Eine Seite (bei Bedarf mehrere): Kopfdaten, Positionen nach Kostengruppe,
//! Summen. Deutsche Beträge mit Komma.

use crate::error::{ExportError, ExportResult};
use opc_core::model::{CalculationResult, CostGroup};
use opc_core::money;
use printpdf::{
    BuiltinFont, Mm, Op, PdfDocument, PdfFontHandle, PdfPage, PdfSaveOptions, Pt, TextItem,
};
use rust_decimal::Decimal;

/// Breite einer A4-Seite in mm.
const PAGE_WIDTH_MM: f32 = 210.0;
/// Höhe einer A4-Seite in mm.
const PAGE_HEIGHT_MM: f32 = 297.0;
/// Linker Rand in mm.
const MARGIN_MM: f32 = 15.0;
/// Schriftgröße Fließtext in pt.
const FONT_SIZE_PT: f32 = 10.0;
/// Schriftgröße Überschriften in pt.
const HEADING_SIZE_PT: f32 = 13.0;
/// Zeilenabstand in mm.
const LINE_HEIGHT_MM: f32 = 6.0;

/// Deutsche Gruppennamen in der Reihenfolge des Rechenkerns.
const GROUPS: &[(CostGroup, &str)] = &[
    (CostGroup::Material, "Material"),
    (CostGroup::Machine, "Maschinenkosten"),
    (CostGroup::Energy, "Energiekosten"),
    (CostGroup::ProcessSurcharge, "Verfahrenszuschläge"),
    (CostGroup::Worksteps, "Arbeitsschritte"),
    (CostGroup::AdditionalItems, "Zusatzartikel"),
    (CostGroup::HandlingFee, "Handlungspauschale"),
    (CostGroup::CustomSurcharge, "Zuschläge"),
    (CostGroup::Margin, "Gewinnmarge"),
    (CostGroup::Tax, "Steuer"),
    (CostGroup::Total, "Gesamtkosten"),
];

/// Erzeugt den PDF-Report als Byte-Folge.
///
/// Pure Funktion: Ergebnis hinein, Bytes heraus — kein IO, kein Clock.
pub fn render_pdf(
    result: &CalculationResult,
    company: &crate::CompanyInfo,
) -> ExportResult<Vec<u8>> {
    if result.positions.is_empty() {
        return Err(ExportError::Empty);
    }

    // Alle Zeilen sammeln: (Text, Überschrift?).
    let mut lines: Vec<(String, bool)> = Vec::new();
    lines.push((
        format!("3D-Druck-Kalkulation: {}", result.project_name),
        true,
    ));
    lines.push((format!("Projekt: {}", result.project_name), false));
    if let Some(created) = &result.created_at {
        lines.push((format!("Erstellt: {created}"), false));
    }
    if !company.name.trim().is_empty() {
        lines.push((format!("Firma: {}", company.name.trim()), false));
        for line in [&company.street, &company.zip_city, &company.email] {
            if !line.trim().is_empty() {
                lines.push((line.trim().to_string(), false));
            }
        }
    }
    lines.push((
        format!(
            "Maschinenstundensatz: {} €/h",
            money::format_de(result.machine_hour_rate, 2)
        ),
        false,
    ));
    lines.push((String::new(), false));

    for (group, label) in GROUPS {
        let positions: Vec<_> = result
            .positions
            .iter()
            .filter(|position| position.group == *group)
            .collect();
        if positions.is_empty() {
            continue;
        }
        lines.push(((*label).to_string(), true));
        for position in positions {
            let mut line = position.label.clone();
            if let Some(detail) = &position.detail {
                line.push_str(&format!(" — {detail}"));
            }
            line.push_str(&format!(": {} €", money::format_de(position.amount, 2)));
            lines.push((truncate(&line, 105), false));
        }
        lines.push((String::new(), false));
    }

    lines.push(("Summen".to_string(), true));
    for (key, amount) in [
        ("Basis", result.base_total),
        ("Marge", result.margin_total),
        ("Steuer", result.tax_total),
        ("Gesamt", result.total),
    ] {
        lines.push((kv(key, amount), amount == result.total));
    }

    // Zeilen auf Seiten verteilen.
    let mut doc = PdfDocument::new(&format!("OpenPrintCost — {}", result.project_name));
    let mut ops: Vec<Op> = Vec::new();
    let mut y = PAGE_HEIGHT_MM - 20.0;
    let mut first_on_page = true;

    for (text, heading) in &lines {
        y -= if *heading {
            LINE_HEIGHT_MM + 2.0
        } else {
            LINE_HEIGHT_MM
        };
        if y < 20.0 {
            doc.pages.push(PdfPage::new(
                Mm(PAGE_WIDTH_MM),
                Mm(PAGE_HEIGHT_MM),
                std::mem::take(&mut ops),
            ));
            y = PAGE_HEIGHT_MM - 20.0;
            first_on_page = true;
        }
        if first_on_page {
            ops.push(Op::StartTextSection);
            first_on_page = false;
        }
        ops.push(Op::SetFont {
            font: PdfFontHandle::Builtin(if *heading {
                BuiltinFont::HelveticaBold
            } else {
                BuiltinFont::Helvetica
            }),
            size: Pt(if *heading {
                HEADING_SIZE_PT
            } else {
                FONT_SIZE_PT
            }),
        });
        ops.push(Op::SetTextCursor {
            pos: printpdf::Point::new(Mm(MARGIN_MM), Mm(y)),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(text.clone())],
        });
    }
    ops.push(Op::EndTextSection);
    doc.pages
        .push(PdfPage::new(Mm(PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), ops));

    Ok(doc.save(&PdfSaveOptions::default(), &mut Vec::new()))
}

/// Kürzt eine Zeile auf eine maximale Zeichenlänge.
fn truncate(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let kept: String = text.chars().take(max - 1).collect();
    format!("{kept}…")
}

/// Baut eine „Schlüssel: Betrag €“-Zeile.
fn kv(key: &str, amount: Decimal) -> String {
    format!("{key}: {} €", money::format_de(amount, 2))
}
