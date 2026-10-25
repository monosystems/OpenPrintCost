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
// Aktualisierungen
// ---------------------------------------------------------------------------

/// Version der laufenden Anwendung.
#[tauri::command]
pub fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Eine vom Update-Server angebotene Version.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    /// Angebotene Version.
    pub version: String,
    /// Laufende Version.
    pub current_version: String,
    /// Release-Notizen (Markdown), sofern der Server welche liefert.
    pub notes: Option<String>,
    /// Veröffentlichungsdatum als RFC 3339, sofern vorhanden.
    pub date: Option<String>,
}

/// Baut den Updater für Produktions-Releases.
///
/// `releases/latest` liefert GitHub-seitig keine Pre-Releases. Der Comparator
/// lehnt Versionen mit Pre-Release-Suffix (`0.2.0-dev.1`, `0.2.0-rc.1`)
/// zusätzlich auf App-Seite ab, damit ein versehentlich veröffentlichtes
/// Pre-Release nie installiert wird.
fn production_updater(app: &tauri::AppHandle) -> CommandResult<tauri_plugin_updater::Updater> {
    use tauri_plugin_updater::UpdaterExt;

    app.updater_builder()
        .version_comparator(|current, remote| {
            remote.version.pre.is_empty() && remote.version > current
        })
        .build()
        .map_err(CommandError::from)
}

/// Fragt den konfigurierten Update-Endpunkt ab.
///
/// Liefert `None`, wenn die laufende Version aktuell ist. Im Debug-Build wird
/// nicht gesucht: ein Entwickler-Build soll keine Release-Pakete anbieten.
#[tauri::command]
pub async fn check_update(app: tauri::AppHandle) -> CommandResult<Option<UpdateInfo>> {
    if cfg!(debug_assertions) {
        return Ok(None);
    }

    let update = production_updater(&app)?
        .check()
        .await
        .map_err(CommandError::from)?;
    Ok(update.map(|update| UpdateInfo {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        notes: update.body.clone(),
        date: update.date.map(|date| date.to_string()),
    }))
}

/// Lädt die angebotene Version herunter, installiert sie und startet neu.
///
/// Auf Windows beendet der Installer die Anwendung selbst; auf macOS und
/// Linux übernimmt das der Neustart am Ende.
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> CommandResult<()> {
    let Some(update) = production_updater(&app)?
        .check()
        .await
        .map_err(CommandError::from)?
    else {
        return Err(CommandError::new(
            "Es ist keine Aktualisierung verfügbar.".to_string(),
        ));
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(CommandError::from)?;
    app.restart();
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

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/// Liest die Firmendaten (leere Werte, wenn noch nichts gespeichert wurde).
#[tauri::command]
pub fn get_company_info(state: State<'_, AppState>) -> CommandResult<opc_store::CompanyInfo> {
    state.store.get_company_info().map_err(CommandError::from)
}

/// Speichert die Firmendaten.
#[tauri::command]
pub fn save_company_info(
    state: State<'_, AppState>,
    info: opc_store::CompanyInfo,
) -> CommandResult<()> {
    state
        .store
        .save_company_info(&info)
        .map_err(CommandError::from)
}

/// Rendert das Ergebnis als PDF und speichert es über den Dateidialog.
///
/// Abbruch des Dialogs ist kein Fehler — dann kommt `None` zurück.
#[tauri::command]
pub fn export_result_pdf(
    app: tauri::AppHandle,
    result: CalculationResult,
    company: opc_store::CompanyInfo,
) -> CommandResult<Option<String>> {
    let bytes =
        opc_export::render_pdf(&result, &to_company(&company)).map_err(CommandError::from)?;
    save_bytes_via_dialog(
        &app,
        &bytes,
        "pdf",
        "PDF-Dokument",
        &format!("{}-kalkulation.pdf", result.project_name),
    )
}

/// Rendert das Ergebnis als Excel-Arbeitsmappe und speichert es.
///
/// Abbruch des Dialogs ist kein Fehler — dann kommt `None` zurück.
#[tauri::command]
pub fn export_result_excel(
    app: tauri::AppHandle,
    result: CalculationResult,
    company: opc_store::CompanyInfo,
) -> CommandResult<Option<String>> {
    let bytes =
        opc_export::render_excel(&result, &to_company(&company)).map_err(CommandError::from)?;
    save_bytes_via_dialog(
        &app,
        &bytes,
        "xlsx",
        "Excel-Arbeitsmappe",
        &format!("{}-kalkulation.xlsx", result.project_name),
    )
}

/// Übersetzt die gespeicherte Firma in die Export-Firmendaten.
fn to_company(company: &opc_store::CompanyInfo) -> opc_export::CompanyInfo {
    opc_export::CompanyInfo {
        name: company.name.clone(),
        street: company.street.clone(),
        zip_city: company.zip_city.clone(),
        email: company.email.clone(),
    }
}

/// Fragt per Speichern-Dialog nach dem Pfad und schreibt die Bytes.
fn save_bytes_via_dialog(
    app: &tauri::AppHandle,
    bytes: &[u8],
    extension: &str,
    filter_name: &str,
    file_name: &str,
) -> CommandResult<Option<String>> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .add_filter(filter_name, &[extension])
        .set_file_name(file_name)
        .blocking_save_file();
    match path {
        None => Ok(None),
        Some(selected) => {
            let file_path = selected
                .into_path()
                .map_err(|error| CommandError::new(format!("Pfad ist ungültig: {error}")))?;
            std::fs::write(&file_path, bytes).map_err(|error| {
                CommandError::new(format!(
                    "Datei '{}' konnte nicht geschrieben werden: {error}",
                    file_path.display()
                ))
            })?;
            Ok(Some(file_path.to_string_lossy().to_string()))
        }
    }
}
