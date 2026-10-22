//! # OpenPrintCost — Persistenz (`opc-store`)
//!
//! Die Crate stellt die **Stammdaten** und **Kalkulationen** der App lokal
//! und dauerhaft bereit.
//!
//! ## Aufbau
//!
//! * [`port`] — der **Port**: die Domänen-API, gegen die die Anwendung
//!   programmiert. Sie kennt **kein** SQL, keine Zeilen und keine Spalten.
//! * [`memory`] — eine In-Memory-Implementierung des Ports (Tests, Prototyp).
//! * [`sqlite`] — die SQLite-Implementierung des Ports.
//!
//! Beide Adapter erfüllen **denselben** Port. Die Integrations Tests laufen
//! gegen beide — damit ist die Austauschbarkeit des Backends belegt.
//!
//! ## Grundsätze
//!
//! * **UUID v4** als Identifikator, in SQLite als `TEXT` — kein
//!   `INTEGER PRIMARY KEY`. Damit bleiben Kalkulationen zwischen
//!   Installationen exportierbar.
//! * **Geldbeträge als `TEXT`.** SQLite kennt keinen exakten Dezimaltyp;
//!   `REAL` wäre eine Fließkommazahl und würde die Exaktheit aus `opc-core`
//!   zerstören.
//! * **Migrationen sind versioniert und eingebettet.** Angewandte Migrationen
//!   werden nie geändert.
//!
//! ## Beispiel
//!
//! ```
//! use opc_core::model::Printer;
//! use opc_store::{MemoryStore, PrinterRepository};
//!
//! let store = MemoryStore::new();
//! let mut printer = Printer::new("Prusa MK4S", opc_core::model::PrintProcess::Fdm);
//! printer.power_watts = "110".parse().unwrap();
//! store.save_printer(&printer).unwrap();
//!
//! assert_eq!(store.list_printers().unwrap().len(), 1);
//! ```

#![forbid(unsafe_code)]

pub mod error;
pub mod memory;
pub mod port;
pub mod record;
pub mod sqlite;

pub use error::{StoreError, StoreResult};
pub use memory::MemoryStore;
pub use port::{
    CalculationRepository, HourlyRateRepository, MaterialRepository, PrinterRepository,
    ProfileRepository, Store, WorkstepCategoryRepository, WorkstepRepository,
};
pub use record::{CalculationSummary, StoredCalculation};
pub use sqlite::SqliteStore;
