//! # OpenPrintCost — Export (`opc-export`)
//!
//! Die Crate erzeugt **PDF-Reports** und **Excel-Arbeitsmappen** aus einem
//! fertigen [`CalculationResult`][opc_core::model::CalculationResult].
//!
//! Die Funktionen sind **pure**: Ergebnis hinein, Bytes heraus. Kein
//! Dateisystem, kein Netzwerk, kein globaler Zustand, keine Uhr — damit
//! sind sie ohne Weiteres testbar und später serverseitig wiederverwendbar
//! (Spec 0001, Abschnitt 11.3).
//!
//! ## Beispiel
//!
//! ```no_run
//! use opc_core::calc::calculate;
//! use opc_export::{CompanyInfo, render_excel, render_pdf};
//! # fn input() -> opc_core::model::CalculationInput { todo!() }
//!
//! let result = calculate(&input()).unwrap();
//! let company = CompanyInfo::default();
//! let pdf: Vec<u8> = render_pdf(&result, &company).unwrap();
//! let xlsx: Vec<u8> = render_excel(&result, &company).unwrap();
//! ```

#![forbid(unsafe_code)]

pub mod error;
pub mod excel;
pub mod pdf;

pub use error::{ExportError, ExportResult};
pub use excel::{render_excel, render_excel_with_locale};
pub use pdf::{render_pdf, render_pdf_with_locale};

/// Sprache der Exportbeschriftungen.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ExportLocale {
    /// Deutsch.
    #[default]
    De,
    /// Englisch.
    En,
}

impl ExportLocale {
    /// Wandelt einen Sprachcode (`de`, `en`, …) in die Exportsprache um.
    pub fn from_code(code: &str) -> Self {
        if code.trim().eq_ignore_ascii_case("de") {
            Self::De
        } else {
            Self::En
        }
    }
}

/// Liefert den deutschen oder englischen Text.
pub(crate) fn tr(locale: ExportLocale, de: &'static str, en: &'static str) -> &'static str {
    if locale == ExportLocale::De { de } else { en }
}

/// Formatiert eine Dezimalzahl passend zur Exportsprache.
pub fn format_number(value: rust_decimal::Decimal, scale: u32, locale: ExportLocale) -> String {
    let text = opc_core::money::format_de(value, scale);
    if locale == ExportLocale::De {
        text
    } else {
        text.replace(',', ".")
    }
}

/// Firmendaten für den Reportkopf.
///
/// Die Oberfläche für Firmendaten gehört zu Block 7 — bis dahin wird eine
/// leere `CompanyInfo` übergeben und der Kopf zeigt nur Projektdaten.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompanyInfo {
    /// Firmenname.
    pub name: String,
    /// Straße und Hausnummer.
    pub street: String,
    /// PLZ und Ort.
    pub zip_city: String,
    /// E-Mail-Adresse.
    pub email: String,
    /// Währungscode (ISO 4217, z. B. "USD") — reines Anzeige-Symbol.
    pub currency: String,
}

impl Default for CompanyInfo {
    fn default() -> Self {
        Self {
            name: String::new(),
            street: String::new(),
            zip_city: String::new(),
            email: String::new(),
            currency: "USD".to_string(),
        }
    }
}

/// Anzeigesymbol eines Währungscodes (USD → $, EUR → €, GBP → £,
/// sonst der Code selbst, z. B. "CHF").
pub fn currency_symbol(code: &str) -> &str {
    match code.trim().to_uppercase().as_str() {
        "" | "USD" => "$",
        "EUR" => "€",
        "GBP" => "£",
        "JPY" | "CNY" | "RMB" => "¥",
        _ => code.trim(),
    }
}

/// Ersetzt das im Rechenkern fest verdrahtete €-Zeichen in Detailtexten
/// durch das Anzeige-Symbol (reine Darstellung, keine Umrechnung).
pub fn localize_detail(detail: &str, currency: &str) -> String {
    let symbol = currency_symbol(currency);
    if symbol == "€" {
        detail.to_string()
    } else {
        detail.replace('€', symbol)
    }
}

/// Ersetzt Systemlabels des Rechenkerns für den Export.
pub fn localize_position_label(label: &str, locale: ExportLocale) -> String {
    if locale == ExportLocale::De {
        return label.to_string();
    }
    let translated = match label {
        "Materialkosten" => "Material costs",
        "Materialkosten (Fehlerrate)" => "Material costs (fail rate)",
        "Maschinenkosten" => "Machine costs",
        "Maschinenkosten (Fehlerrate)" => "Machine costs (fail rate)",
        "Energiekosten" => "Energy costs",
        "Energiekosten (Fehlerrate)" => "Energy costs (fail rate)",
        "Düsenverschleiß" => "Nozzle wear",
        "Druckplattenverschleiß" => "Build plate wear",
        "Materialwechsel" => "Material change",
        "Handlungspauschale" => "Handling fee",
        "Gewinnmarge" => "Profit margin",
        "Steuer" => "Tax",
        "Verkaufspreis" => "Selling price",
        other => other,
    };
    translated.to_string()
}

/// Detailtext passend zur Exportsprache (Dezimalkomma bzw. Punkt).
pub fn localize_detail_locale(detail: &str, currency: &str, locale: ExportLocale) -> String {
    let text = localize_detail(detail, currency);
    if locale == ExportLocale::De {
        text
    } else {
        text.replace(',', ".")
            .replace("Verbrauch", "consumption")
            .replace(" auf ", " of ")
            .replace("pro Stunde", "per hour")
            .replace("pro Stück", "per piece")
            .replace("pro Auftrag", "per order")
            .replace("einmal je Kalkulation", "once per calculation")
            .replace("Stk", "pcs")
    }
}

/// Gruppenbeschriftung für den Export.
pub fn group_label(group: opc_core::model::CostGroup, locale: ExportLocale) -> &'static str {
    use opc_core::model::CostGroup;
    match (group, locale) {
        (CostGroup::Material, ExportLocale::De) => "Material",
        (CostGroup::Material, ExportLocale::En) => "Material",
        (CostGroup::Machine, ExportLocale::De) => "Maschinenkosten",
        (CostGroup::Machine, ExportLocale::En) => "Machine costs",
        (CostGroup::Energy, ExportLocale::De) => "Energiekosten",
        (CostGroup::Energy, ExportLocale::En) => "Energy costs",
        (CostGroup::ProcessSurcharge, ExportLocale::De) => "Verfahrenszuschläge",
        (CostGroup::ProcessSurcharge, ExportLocale::En) => "Process surcharges",
        (CostGroup::Worksteps, ExportLocale::De) => "Arbeitsschritte",
        (CostGroup::Worksteps, ExportLocale::En) => "Work steps",
        (CostGroup::AdditionalItems, ExportLocale::De) => "Zusatzartikel",
        (CostGroup::AdditionalItems, ExportLocale::En) => "Additional items",
        (CostGroup::HandlingFee, ExportLocale::De) => "Handlungspauschale",
        (CostGroup::HandlingFee, ExportLocale::En) => "Handling fee",
        (CostGroup::CustomSurcharge, ExportLocale::De) => "Zuschläge",
        (CostGroup::CustomSurcharge, ExportLocale::En) => "Surcharges",
        (CostGroup::Margin, ExportLocale::De) => "Gewinnmarge",
        (CostGroup::Margin, ExportLocale::En) => "Profit margin",
        (CostGroup::Tax, ExportLocale::De) => "Steuer",
        (CostGroup::Tax, ExportLocale::En) => "Tax",
        (CostGroup::Total, ExportLocale::De) => "Verkaufspreis",
        (CostGroup::Total, ExportLocale::En) => "Selling price",
    }
}
