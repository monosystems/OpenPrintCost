//! # OpenPrintCost — Rechenkern (`opc-core`)
//!
//! Reine, sofort testbare Kostenberechnung für 3D-Druck-Aufträge.
//!
//! Der Kern bildet die vollständige Kostenkalkulation ab (Spec 0001,
//! Abschnitt 4):
//!
//! ```text
//! Kosten = Material + Maschine + Energie + Verfahrenszuschläge
//!         + Arbeitsschritte + Zusatzartikel + Handlungspauschale
//!         + Zuschläge + Marge + Steuer
//! ```
//!
//! ## Eigenschaften
//!
//! * **Pure** — keine Dateisystemzugriffe, kein Netzwerk, kein globaler
//!   Zustand, keine Uhr. Zeitstempel werden vom Aufrufer geliefert.
//! * **Exakt** — alle Geldbeträge sind [`rust_decimal::Decimal`]; `f64` kommt
//!   nirgends vor. Gerundet wird erst bei der Anzeige.
//! * **Fehler statt Panic** — die Engine liefert `Result`; eine
//!   Verpackungsgröße von 0 ergibt `Err`, nicht `0` und keinen Absturz.
//! * **Serialisierbar** — `Decimal` wird als **String** serialisiert, damit
//!   Exporte diff-freundlich und verlustfrei bleiben.
//! * **WASM-fähig** — der Kern kompiliert nach `wasm32-unknown-unknown`,
//!   sodass später eine Browser-Variante ohne zweites Rechenmodell möglich
//!   ist.
//!
//! ## Beispiel
//!
//! ```
//! use opc_core::model::{CalculationInput, CalculationProfile, FileMaterial, Material};
//! use opc_core::calc::calculate;
//! use rust_decimal_macros::dec;
//!
//! let mut material = Material::new("PLA", "PLA");
//! material.price = dec!(25);
//! material.density_g_cm3 = dec!(1.24);
//!
//! let mut file = opc_core::model::CalculationFileInput::new("Würfel.stl", 1, dec!(2));
//! file.volume_cm3 = Some(dec!(10));
//! file.materials.push(FileMaterial::new(material));
//!
//! let mut printer = opc_core::model::Printer::new(
//!     "Test-Drucker",
//!     opc_core::model::PrintProcess::Fdm,
//! );
//! printer.power_watts = dec!(100);
//!
//! let mut input = CalculationInput::new("Beispiel", printer);
//! input.profile = CalculationProfile {
//!     energy_price_per_kwh: dec!(0.35),
//!     apply_energy_costs: true,
//!     ..CalculationProfile::default()
//! };
//! input.files.push(file);
//!
//! let result = calculate(&input).unwrap();
//! assert_eq!(result.total, dec!(0.38));
//! ```

#![forbid(unsafe_code)]

pub mod calc;
pub mod model;
pub mod money;
pub mod units;

pub use calc::{CalcError, calculate};
pub use model::{
    AdditionalItem, CalculationFileInput, CalculationInput, CalculationProfile, CalculationResult,
    CostGroup, CostPosition, CustomSurcharge, FileMaterial, FileSummary, HandlingFeeScope,
    HourlyRate, Material, MaterialFamily, PrintProcess, Printer, SurchargeTiming, TimeBasis,
    Workstep, WorkstepCalculationType, WorkstepCategory, WorkstepTiming,
};
