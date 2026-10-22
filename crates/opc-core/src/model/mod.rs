//! Domänenmodell von OpenPrintCost.
//!
//! Die Stammdatenobjekte ([`Printer`], [`Material`], [`Workstep`],
//! [`HourlyRate`]) sind wiederverwendbar. Eine [`CalculationInput`] nimmt
//! einen **Schnappschuss** der verwendeten Stammdaten auf, damit spätere
//! Änderungen an den Stammdaten historische Kalkulationen nicht verändern
//! (Spec 0001, Abschnitt 2).
//!
//! Jede Entität trägt eine **UUID v4** als Identifikator. Damit sind
//! Kalkulationen zwischen Installationen exportierbar und importierbar, ohne
//! dass IDs kollidieren (Spec 0001, Abschnitt 11.1).

pub mod calculation;
pub mod cost_position;
pub mod hourly_rate;
pub mod material;
pub mod printer;
pub mod workstep;

pub use calculation::{
    AdditionalItem, CalculationFileInput, CalculationInput, CalculationProfile, CustomSurcharge,
    FileMaterial, HandlingFeeScope, SurchargeTiming,
};
pub use cost_position::{CalculationResult, CostGroup, CostPosition, FileSummary};
pub use hourly_rate::{HourlyRate, TimeBasis};
pub use material::{Material, MaterialFamily};
pub use printer::{PrintProcess, Printer};
pub use workstep::{Workstep, WorkstepCalculationType, WorkstepCategory, WorkstepTiming};
