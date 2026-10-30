//! PDF-Report einer Kalkulation.
//!
//! Eine Seite (bei Bedarf mehrere): Kopfdaten, Notizen, Positionen nach
//! Kostengruppe, Summen. Deutsche Beträge mit Komma.

use crate::ExportLocale;
use crate::error::{ExportError, ExportResult};
use opc_core::model::{CalculationResult, CostGroup};
use printpdf::{
    BuiltinFont, FontId, Mm, Op, ParsedFont, PdfDocument, PdfFontHandle, PdfPage, PdfSaveOptions,
    Point, Pt, TextItem,
};
use rust_decimal::Decimal;
use std::sync::OnceLock;

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
/// Schriftgröße Fußzeile in pt.
const FOOTER_SIZE_PT: f32 = 8.0;
/// Zeilenabstand in mm.
const LINE_HEIGHT_MM: f32 = 6.0;
/// Maximale Anzeigebreite einer Textzeile (ca. 180 mm bei 10 pt).
/// CJK-Zeichen zählen doppelt, ASCII-Zeichen einfach.
const TEXT_WIDTH: usize = 95;
/// Maximale Anzeigebreite einer Positionszeile vor dem Betrag.
const POSITION_TEXT_WIDTH: usize = 78;
/// Eingebettete Unicode-Schrift (Noto Sans CJK, OFL) für CJK-fähige Reports.
const UNICODE_FONT: &[u8] = include_bytes!("../assets/NotoSansCJK-Regular.ttc");
/// Index der SC-Schrift innerhalb der TTC-Sammlung.
const UNICODE_FONT_INDEX: usize = 2;
/// Einmal geparste Schrift — die 19-MB-TTC wird nicht je Export neu verarbeitet.
static PARSED_UNICODE_FONT: OnceLock<Option<ParsedFont>> = OnceLock::new();

/// Reihenfolge der Kostengruppen im Rechenkern.
const GROUPS: &[CostGroup] = &[
    CostGroup::Material,
    CostGroup::Machine,
    CostGroup::Energy,
    CostGroup::ProcessSurcharge,
    CostGroup::Worksteps,
    CostGroup::AdditionalItems,
    CostGroup::HandlingFee,
    CostGroup::CustomSurcharge,
    CostGroup::Margin,
    CostGroup::Tax,
    CostGroup::Total,
];

/// Eine Zeile im Report.
struct Line {
    text: String,
    heading: bool,
}

/// Erzeugt den PDF-Report als Byte-Folge.
///
/// Pure Funktion: Ergebnis hinein, Bytes heraus — kein IO, kein Clock.
pub fn render_pdf(
    result: &CalculationResult,
    company: &crate::CompanyInfo,
) -> ExportResult<Vec<u8>> {
    render_pdf_with_locale(result, company, ExportLocale::De)
}

/// Erzeugt den PDF-Report in der gewünschten Sprache.
pub fn render_pdf_with_locale(
    result: &CalculationResult,
    company: &crate::CompanyInfo,
    locale: ExportLocale,
) -> ExportResult<Vec<u8>> {
    if result.positions.is_empty() {
        return Err(ExportError::Empty);
    }

    let symbol = crate::currency_symbol(&company.currency);
    let mut doc = PdfDocument::new(&format!("OpenPrintCost — {}", result.project_name));
    let parsed_font = PARSED_UNICODE_FONT
        .get_or_init(|| ParsedFont::from_bytes(UNICODE_FONT, UNICODE_FONT_INDEX, &mut Vec::new()));
    let font_id: Option<FontId> = parsed_font.as_ref().map(|font| doc.add_font(font));
    let mut lines: Vec<Line> = Vec::new();
    push_wrapped(
        &mut lines,
        &format!(
            "{}: {}",
            crate::tr(locale, "3D-Druck-Kalkulation", "3D printing calculation"),
            result.project_name
        ),
        true,
    );
    push_wrapped(
        &mut lines,
        &format!(
            "{}: {}",
            crate::tr(locale, "Projekt", "Project"),
            result.project_name
        ),
        false,
    );
    if let Some(created) = &result.created_at {
        push_wrapped(
            &mut lines,
            &format!("{}: {created}", crate::tr(locale, "Erstellt", "Created")),
            false,
        );
    }
    if !company.name.trim().is_empty() {
        push_wrapped(
            &mut lines,
            &format!(
                "{}: {}",
                crate::tr(locale, "Firma", "Company"),
                company.name.trim()
            ),
            false,
        );
        for line in [&company.street, &company.zip_city, &company.email] {
            if !line.trim().is_empty() {
                push_wrapped(&mut lines, line.trim(), false);
            }
        }
    }
    if let Some(notes) = &result.notes
        && !notes.trim().is_empty()
    {
        push_wrapped(
            &mut lines,
            &format!(
                "{}: {}",
                crate::tr(locale, "Notizen", "Notes"),
                notes.trim()
            ),
            false,
        );
    }
    push_wrapped(
        &mut lines,
        &format!(
            "{}: {} {symbol}/h",
            crate::tr(locale, "Maschinenstundensatz", "Machine hourly rate"),
            crate::format_number(result.machine_hour_rate, 2, locale)
        ),
        false,
    );
    lines.push(Line {
        text: String::new(),
        heading: false,
    });

    if !result.files.is_empty() {
        push_wrapped(&mut lines, crate::tr(locale, "Dateien", "Files"), true);
        for file in &result.files {
            let mut line = format!(
                "{} — {} {}",
                file.file_name,
                file.quantity,
                crate::tr(locale, "Stk.", "pcs")
            );
            if let Some(dimensions) = file.dimensions_mm {
                line.push_str(&format!(
                    " — {}: {} × {} × {} mm",
                    crate::tr(locale, "Maße", "Dimensions"),
                    crate::format_number(dimensions[0], 2, locale),
                    crate::format_number(dimensions[1], 2, locale),
                    crate::format_number(dimensions[2], 2, locale)
                ));
            }
            match file.fits_build_volume {
                Some(true) => line.push_str(&format!(
                    " — {}",
                    crate::tr(locale, "passt ins Bauvolumen", "fits build volume")
                )),
                Some(false) => line.push_str(&format!(
                    " — {}",
                    crate::tr(
                        locale,
                        "überschreitet das Bauvolumen",
                        "exceeds build volume"
                    )
                )),
                None => {}
            }
            push_wrapped(&mut lines, &line, false);
        }
        lines.push(Line {
            text: String::new(),
            heading: false,
        });
    }

    for group in GROUPS {
        let positions: Vec<_> = result
            .positions
            .iter()
            .filter(|position| position.group == *group)
            .collect();
        if positions.is_empty() {
            continue;
        }
        push_wrapped(&mut lines, crate::group_label(*group, locale), true);
        for position in positions {
            let label = crate::localize_position_label(&position.label, locale);
            let mut text = match position.file_id {
                Some(file_id) => match result.files.iter().find(|file| file.file_id == file_id) {
                    Some(file) if !file.file_name.trim().is_empty() => {
                        format!("{} — {label}", file.file_name.trim())
                    }
                    _ => label,
                },
                None => label,
            };
            if let Some(detail) = &position.detail {
                text.push_str(" — ");
                text.push_str(&crate::localize_detail_locale(
                    detail,
                    &company.currency,
                    locale,
                ));
            }
            let amount = format!(
                "{} {symbol}",
                crate::format_number(position.amount, 2, locale)
            );
            push_amount_line(&mut lines, &text, &amount);
        }
        lines.push(Line {
            text: String::new(),
            heading: false,
        });
    }

    push_wrapped(&mut lines, crate::tr(locale, "Summen", "Totals"), true);
    for (key, amount) in [
        (
            crate::tr(locale, "Herstellkosten", "Manufacturing costs"),
            result.base_total,
        ),
        (crate::tr(locale, "Marge", "Margin"), result.margin_total),
        (crate::tr(locale, "Steuer", "Tax"), result.tax_total),
        (
            crate::tr(locale, "Verkaufspreis", "Selling price"),
            result.total,
        ),
    ] {
        lines.push(Line {
            text: kv_currency(key, amount, symbol, locale),
            heading: key == crate::tr(locale, "Verkaufspreis", "Selling price"),
        });
    }
    if let Some(price_per_piece) = result.price_per_piece {
        lines.push(Line {
            text: kv_currency(
                crate::tr(locale, "Preis je Stück", "Price per piece"),
                price_per_piece,
                symbol,
                locale,
            ),
            heading: false,
        });
    }

    // Zeilen auf Seiten verteilen. Jede Seite hat genau eine Textsektion und
    // eine Fußzeile mit Seitenzahl.
    let mut ops: Vec<Op> = Vec::new();
    let mut y = PAGE_HEIGHT_MM - 20.0;
    let mut page = 1usize;
    ops.push(Op::StartTextSection);

    for line in &lines {
        let step = if line.heading {
            LINE_HEIGHT_MM + 2.0
        } else {
            LINE_HEIGHT_MM
        };
        if y - step < 26.0 {
            ops.push(Op::EndTextSection);
            add_footer(&mut ops, page, locale, font_id.as_ref());
            doc.pages.push(PdfPage::new(
                Mm(PAGE_WIDTH_MM),
                Mm(PAGE_HEIGHT_MM),
                std::mem::take(&mut ops),
            ));
            page += 1;
            y = PAGE_HEIGHT_MM - 20.0;
            ops.push(Op::StartTextSection);
        }
        y -= step;
        ops.push(Op::SetFont {
            font: match &font_id {
                Some(id) => PdfFontHandle::External(id.clone()),
                None => PdfFontHandle::Builtin(if line.heading {
                    BuiltinFont::HelveticaBold
                } else {
                    BuiltinFont::Helvetica
                }),
            },
            size: Pt(if line.heading {
                HEADING_SIZE_PT
            } else {
                FONT_SIZE_PT
            }),
        });
        ops.push(Op::SetTextCursor {
            pos: Point::new(Mm(MARGIN_MM), Mm(y)),
        });
        ops.push(Op::ShowText {
            items: vec![TextItem::Text(line.text.clone())],
        });
    }
    ops.push(Op::EndTextSection);
    add_footer(&mut ops, page, locale, font_id.as_ref());
    doc.pages
        .push(PdfPage::new(Mm(PAGE_WIDTH_MM), Mm(PAGE_HEIGHT_MM), ops));

    Ok(doc.save(&PdfSaveOptions::default(), &mut Vec::new()))
}

/// Fügt eine Textzeile mit Wortumbruch hinzu.
fn push_wrapped(lines: &mut Vec<Line>, text: &str, heading: bool) {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        lines.push(Line {
            text: String::new(),
            heading: false,
        });
        return;
    }
    for paragraph in trimmed.lines() {
        for part in wrap_text(paragraph, TEXT_WIDTH) {
            lines.push(Line {
                text: part,
                heading,
            });
        }
    }
}

/// Fügt eine Positionszeile hinzu; der Betrag steht am Ende der letzten Zeile.
fn push_amount_line(lines: &mut Vec<Line>, text: &str, amount: &str) {
    let parts = wrap_text(text, POSITION_TEXT_WIDTH);
    if parts.is_empty() {
        lines.push(Line {
            text: amount.to_string(),
            heading: false,
        });
        return;
    }
    let last = parts.len() - 1;
    for (index, part) in parts.into_iter().enumerate() {
        lines.push(Line {
            text: if index == last {
                format!("{part}: {amount}")
            } else {
                part
            },
            heading: false,
        });
    }
}

/// Bricht Text an Wortgrenzen auf höchstens `max` Anzeigebreiten um.
fn wrap_text(text: &str, max: usize) -> Vec<String> {
    let mut result = Vec::new();
    let mut rest = text.trim();
    while display_width(rest) > max {
        let mut width = 0;
        let mut cut = rest.len();
        for (index, character) in rest.char_indices() {
            let next = width + display_width_char(character);
            if next > max {
                cut = index;
                break;
            }
            width = next;
        }
        if let Some(space) = rest[..cut].rfind(' ')
            && space > 0
        {
            cut = space;
        }
        let part = rest[..cut].trim_end();
        if !part.is_empty() {
            result.push(part.to_string());
        }
        rest = rest[cut..].trim_start();
    }
    if !rest.is_empty() {
        result.push(rest.to_string());
    }
    result
}

/// Anzeigebreite eines Zeichens (CJK/Emoji zählen doppelt).
fn display_width_char(character: char) -> usize {
    if character.is_ascii() || character.is_whitespace() {
        1
    } else {
        2
    }
}

/// Anzeigebreite eines Textes in ASCII-Zeicheneinheiten.
fn display_width(text: &str) -> usize {
    text.chars().map(display_width_char).sum()
}

/// Hängt eine Fußzeile mit Seitenzahl an die aktuelle Seite.
fn add_footer(ops: &mut Vec<Op>, page: usize, locale: ExportLocale, font_id: Option<&FontId>) {
    ops.push(Op::StartTextSection);
    ops.push(Op::SetFont {
        font: match font_id {
            Some(id) => PdfFontHandle::External(id.clone()),
            None => PdfFontHandle::Builtin(BuiltinFont::Helvetica),
        },
        size: Pt(FOOTER_SIZE_PT),
    });
    ops.push(Op::SetTextCursor {
        pos: Point::new(Mm(MARGIN_MM), Mm(10.0)),
    });
    ops.push(Op::ShowText {
        items: vec![TextItem::Text(format!(
            "OpenPrintCost — {} {page}",
            crate::tr(locale, "Seite", "Page")
        ))],
    });
    ops.push(Op::EndTextSection);
}

/// Baut eine „Schlüssel: Betrag Währung“-Zeile mit explizitem Symbol.
fn kv_currency(key: &str, amount: Decimal, symbol: &str, locale: ExportLocale) -> String {
    format!(
        "{key}: {} {symbol}",
        crate::format_number(amount, 2, locale)
    )
}
