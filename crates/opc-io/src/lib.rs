//! # OpenPrintCost — Datei-Import (`opc-io`)
//!
//! Die Crate liest Druckdateien **rein lesend** ein und liefert strukturierte
//! Mengengerüste für den Rechenkern:
//!
//! * [`stl`] — Volumenberechnung aus STL-Meshes (binär und ASCII) über die
//!   Tetraeder-Summation.
//! * [`gcode`] — Druckzeit und Filamentverbrauch aus GCode-Dateien: zuerst aus
//!   den Slicer-Kommentaren, ersatzweise aus einer geometrischen Simulation
//!   der Fahrbewegungen.
//!
//! Die Crate ist **pure**: Bytes oder Text hinein, Struktur heraus. Kein
//! Dateisystem, kein Netzwerk, kein globaler Zustand — damit laufen alle
//! Tests ohne Fixture-Dateien auf der Platte (Spec 0002, Block 3).

#![forbid(unsafe_code)]

pub mod error;
pub mod gcode;
pub mod stl;

pub use error::{IoError, IoResult};
pub use gcode::{FilamentUsage, GcodeInfo, parse_gcode};
pub use stl::{StlInfo, Triangle, parse_stl};
