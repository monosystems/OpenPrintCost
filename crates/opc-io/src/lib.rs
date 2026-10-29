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
//! * [`threemf`] — 3MF-Projektdateien: Mesh-Volumen, Materialien, Bauvolumen
//!   sowie Zeit- und Filamentmetadaten von Bambu Studio, OrcaSlicer und
//!   PrusaSlicer.
//!
//! Die Crate ist **pure**: Bytes oder Text hinein, Struktur heraus. Kein
//! Dateisystem, kein Netzwerk, kein globaler Zustand — damit laufen alle
//! Tests ohne Fixture-Dateien auf der Platte (Spec 0002, Block 3).

#![forbid(unsafe_code)]

pub mod error;
pub mod gcode;
pub mod stl;
pub mod threemf;

pub use error::{IoError, IoResult};
pub use gcode::{FilamentUsage, GcodeInfo, parse_gcode};
pub use stl::{StlInfo, Triangle, parse_stl};
pub use threemf::{ThreeMfInfo, parse_3mf};
