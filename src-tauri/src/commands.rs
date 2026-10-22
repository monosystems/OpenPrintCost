//! Die Tauri-Commands — die einzige Grenze zwischen Oberfläche und Fachlogik.
//!
//! Jeder Command arbeitet ausschließlich gegen den **Port**
//! (`Arc<dyn Store>`). Es gibt hier kein SQLite, keine SQL-Abfrage und keine
//! Kenntnis des Datenmodells (Spec 0005, Akzeptanzkriterium 12).
//!
//! IDs werden als `String` transportiert (UUID-Text) und hier in `Uuid`
//! geparst — eine ungültige ID ergibt einen Fehler, keine Panic.

use crate::AppState;
use crate::error::{CommandError, CommandResult};
use opc_core::model::{
    CalculationInput, CalculationProfile, CalculationResult, HourlyRate, Material, Printer,
    Workstep, WorkstepCategory,
};
use opc_store::record::{CalculationSummary, StoredCalculation};
use tauri::State;
use uuid::Uuid;

/// Parst eine UUID aus der übergebenen Zeichenkette.
fn parse_id(value: &str) -> CommandResult<Uuid> {
    Uuid::parse_str(value).map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Drucker
// ---------------------------------------------------------------------------

/// Alle Drucker.
#[tauri::command]
pub fn list_printers(state: State<'_, AppState>) -> CommandResult<Vec<Printer>> {
    state.store.list_printers().map_err(CommandError::from)
}

/// Ein Drucker nach ID.
#[tauri::command]
pub fn get_printer(state: State<'_, AppState>, id: String) -> CommandResult<Printer> {
    state
        .store
        .get_printer(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Legt einen Drucker an oder aktualisiert ihn.
#[tauri::command]
pub fn save_printer(state: State<'_, AppState>, printer: Printer) -> CommandResult<()> {
    state
        .store
        .save_printer(&printer)
        .map_err(CommandError::from)
}

/// Löscht einen Drucker.
#[tauri::command]
pub fn delete_printer(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_printer(parse_id(&id)?)
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Material
// ---------------------------------------------------------------------------

/// Alle Materialien.
#[tauri::command]
pub fn list_materials(state: State<'_, AppState>) -> CommandResult<Vec<Material>> {
    state.store.list_materials().map_err(CommandError::from)
}

/// Ein Material nach ID.
#[tauri::command]
pub fn get_material(state: State<'_, AppState>, id: String) -> CommandResult<Material> {
    state
        .store
        .get_material(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Legt ein Material an oder aktualisiert es.
#[tauri::command]
pub fn save_material(state: State<'_, AppState>, material: Material) -> CommandResult<()> {
    state
        .store
        .save_material(&material)
        .map_err(CommandError::from)
}

/// Löscht ein Material.
#[tauri::command]
pub fn delete_material(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_material(parse_id(&id)?)
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Arbeitsschritte
// ---------------------------------------------------------------------------

/// Alle Arbeitsschritt-Kategorien.
#[tauri::command]
pub fn list_workstep_categories(
    state: State<'_, AppState>,
) -> CommandResult<Vec<WorkstepCategory>> {
    state
        .store
        .list_workstep_categories()
        .map_err(CommandError::from)
}

/// Legt eine Kategorie an oder aktualisiert sie.
#[tauri::command]
pub fn save_workstep_category(
    state: State<'_, AppState>,
    category: WorkstepCategory,
) -> CommandResult<()> {
    state
        .store
        .save_workstep_category(&category)
        .map_err(CommandError::from)
}

/// Löscht eine Kategorie.
#[tauri::command]
pub fn delete_workstep_category(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_workstep_category(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Alle Arbeitsschritte.
#[tauri::command]
pub fn list_worksteps(state: State<'_, AppState>) -> CommandResult<Vec<Workstep>> {
    state.store.list_worksteps().map_err(CommandError::from)
}

/// Ein Arbeitsschritt nach ID.
#[tauri::command]
pub fn get_workstep(state: State<'_, AppState>, id: String) -> CommandResult<Workstep> {
    state
        .store
        .get_workstep(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Legt einen Arbeitsschritt an oder aktualisiert ihn.
#[tauri::command]
pub fn save_workstep(state: State<'_, AppState>, workstep: Workstep) -> CommandResult<()> {
    state
        .store
        .save_workstep(&workstep)
        .map_err(CommandError::from)
}

/// Löscht einen Arbeitsschritt.
#[tauri::command]
pub fn delete_workstep(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_workstep(parse_id(&id)?)
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Maschinenstundensätze
// ---------------------------------------------------------------------------

/// Alle Maschinenstundensätze.
#[tauri::command]
pub fn list_hourly_rates(state: State<'_, AppState>) -> CommandResult<Vec<HourlyRate>> {
    state.store.list_hourly_rates().map_err(CommandError::from)
}

/// Ein Maschinenstundensatz nach ID.
#[tauri::command]
pub fn get_hourly_rate(state: State<'_, AppState>, id: String) -> CommandResult<HourlyRate> {
    state
        .store
        .get_hourly_rate(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Legt einen Maschinenstundensatz an oder aktualisiert ihn.
#[tauri::command]
pub fn save_hourly_rate(state: State<'_, AppState>, rate: HourlyRate) -> CommandResult<()> {
    state
        .store
        .save_hourly_rate(&rate)
        .map_err(CommandError::from)
}

/// Löscht einen Maschinenstundensatz.
#[tauri::command]
pub fn delete_hourly_rate(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_hourly_rate(parse_id(&id)?)
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Kalkulationsprofile
// ---------------------------------------------------------------------------

/// Alle Kalkulationsprofile.
#[tauri::command]
pub fn list_calculation_profiles(
    state: State<'_, AppState>,
) -> CommandResult<Vec<CalculationProfile>> {
    state
        .store
        .list_calculation_profiles()
        .map_err(CommandError::from)
}

/// Ein Kalkulationsprofil nach ID.
#[tauri::command]
pub fn get_calculation_profile(
    state: State<'_, AppState>,
    id: String,
) -> CommandResult<CalculationProfile> {
    state
        .store
        .get_calculation_profile(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Legt ein Kalkulationsprofil an oder aktualisiert es.
#[tauri::command]
pub fn save_calculation_profile(
    state: State<'_, AppState>,
    profile: CalculationProfile,
) -> CommandResult<()> {
    state
        .store
        .save_calculation_profile(&profile)
        .map_err(CommandError::from)
}

/// Löscht ein Kalkulationsprofil.
#[tauri::command]
pub fn delete_calculation_profile(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_calculation_profile(parse_id(&id)?)
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Kalkulationen
// ---------------------------------------------------------------------------

/// Kurzfassungen aller gespeicherten Kalkulationen.
#[tauri::command]
pub fn list_calculations(state: State<'_, AppState>) -> CommandResult<Vec<CalculationSummary>> {
    state.store.list_calculations().map_err(CommandError::from)
}

/// Eine gespeicherte Kalkulation mit Schnappschuss.
#[tauri::command]
pub fn get_calculation(state: State<'_, AppState>, id: String) -> CommandResult<StoredCalculation> {
    state
        .store
        .get_calculation(parse_id(&id)?)
        .map_err(CommandError::from)
}

/// Legt eine Kalkulation an oder aktualisiert sie.
#[tauri::command]
pub fn save_calculation(
    state: State<'_, AppState>,
    calculation: CalculationInput,
) -> CommandResult<()> {
    state
        .store
        .save_calculation(&calculation)
        .map_err(CommandError::from)
}

/// Löscht eine Kalkulation.
#[tauri::command]
pub fn delete_calculation(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .store
        .delete_calculation(parse_id(&id)?)
        .map_err(CommandError::from)
}

// ---------------------------------------------------------------------------
// Berechnung
// ---------------------------------------------------------------------------

/// Rechnet eine Kalkulation durch.
///
/// Die Berechnung braucht **keinen** Datenbankzugriff — sie läuft im
/// Rechenkern `opc-core`.
#[tauri::command]
pub fn calculate(calculation: CalculationInput) -> CommandResult<CalculationResult> {
    opc_core::calculate(&calculation).map_err(CommandError::from)
}

/// Pfad der verwendeten Datenbankdatei — für die Anzeige in den Einstellungen.
#[tauri::command]
pub fn database_path(state: State<'_, AppState>) -> CommandResult<String> {
    Ok(state.database_path.to_string_lossy().to_string())
}

// ---------------------------------------------------------------------------
// Datei-Import
// ---------------------------------------------------------------------------

/// Liest eine GCode-Datei vom Pfad und liefert Druckzeit + Filamentverbrauch.
///
/// Das Backend liest die Datei selbst, damit Binär- und Großdateien nicht
/// durch die JSON-Grenze müssen (Spec 0009).
#[tauri::command]
pub fn import_gcode_file(path: String) -> CommandResult<opc_io::GcodeInfo> {
    let text = std::fs::read_to_string(&path).map_err(|error| {
        CommandError::new(format!(
            "Datei '{path}' konnte nicht gelesen werden: {error}"
        ))
    })?;
    opc_io::parse_gcode(&text).map_err(CommandError::from)
}

/// Liest eine STL-Datei vom Pfad und liefert Volumen + Dreieckszahl.
#[tauri::command]
pub fn import_stl_file(path: String) -> CommandResult<opc_io::StlInfo> {
    let bytes = std::fs::read(&path).map_err(|error| {
        CommandError::new(format!(
            "Datei '{path}' konnte nicht gelesen werden: {error}"
        ))
    })?;
    opc_io::parse_stl(&bytes).map_err(CommandError::from)
}
