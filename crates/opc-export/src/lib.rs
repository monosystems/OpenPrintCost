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
pub use excel::render_excel;
pub use pdf::render_pdf;

/// Firmendaten für den Reportkopf.
///
/// Die Oberfläche für Firmendaten gehört zu Block 7 — bis dahin wird eine
/// leere `CompanyInfo` übergeben und der Kopf zeigt nur Projektdaten.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CompanyInfo {
    /// Firmenname.
    pub name: String,
    /// Straße und Hausnummer.
    pub street: String,
    /// PLZ und Ort.
    pub zip_city: String,
    /// E-Mail-Adresse.
    pub email: String,
}
