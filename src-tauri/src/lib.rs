//! Die Tauri-Anwendung.
//!
//! Die App hält genau **einen** Zustand: den Speicherport. Alle Commands
//! arbeiten gegen diesen Port — weder die Oberfläche noch die Commands
//! kennen das konkrete Backend.

pub mod commands;
pub mod error;

use opc_store::{SqliteStore, Store};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

/// Der von Tauri verwaltete Anwendungszustand.
pub struct AppState {
    /// Der Speicherport — die einzige Persistenz-Schnittstelle.
    pub store: Arc<dyn Store>,
    /// Pfad der verwendeten Datenbankdatei.
    pub database_path: PathBuf,
}

impl AppState {
    /// Erzeugt den Zustand mit einem konkreten Store.
    pub fn new(store: Arc<dyn Store>, database_path: PathBuf) -> Self {
        Self {
            store,
            database_path,
        }
    }
}

/// Startet die Desktop-Anwendung.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Die Datenbank liegt im Benutzerdatenverzeichnis der App — sie
            // gehört dem Benutzer und wird nicht hochgeladen.
            let directory = app.path().app_data_dir()?;
            let database_path = directory.join("openprintcost.db");
            let store = SqliteStore::open(&database_path)?;
            app.manage(AppState::new(Arc::new(store), database_path));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_printers,
            commands::get_printer,
            commands::save_printer,
            commands::delete_printer,
            commands::list_materials,
            commands::get_material,
            commands::save_material,
            commands::delete_material,
            commands::list_workstep_categories,
            commands::save_workstep_category,
            commands::delete_workstep_category,
            commands::list_worksteps,
            commands::get_workstep,
            commands::save_workstep,
            commands::delete_workstep,
            commands::list_hourly_rates,
            commands::get_hourly_rate,
            commands::save_hourly_rate,
            commands::delete_hourly_rate,
            commands::list_calculation_profiles,
            commands::get_calculation_profile,
            commands::save_calculation_profile,
            commands::delete_calculation_profile,
            commands::list_calculations,
            commands::get_calculation,
            commands::save_calculation,
            commands::delete_calculation,
            commands::calculate,
            commands::database_path,
        ])
        .run(tauri::generate_context!())
        .expect("OpenPrintCost konnte nicht gestartet werden");
}
