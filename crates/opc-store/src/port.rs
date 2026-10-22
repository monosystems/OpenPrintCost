//! Der **Port** — die Domänen-API des Speichers.
//!
//! Der Port ist die einzige Stelle, an der die Anwendung mit persistierten
//! Daten spricht. Er enthält **keinen SQL-Leak**: keine Row-Typen, keine
//! Query-Bausteine, keine Spaltennamen. Wer den Port liest, weiß nicht, ob
//! dahinter SQLite, eine In-Memory-Map oder später etwas anderes steckt
//! (Spec 0001, Abschnitt 11.1).
//!
//! Die Traits sind bewusst klein und pro Aggregat getrennt, damit ein Adapter
//! nur die Teilmenge implementieren muss, die er tatsächlich unterstützt.

use crate::error::StoreResult;
use crate::record::{CalculationSummary, CompanyInfo, StoredCalculation};
use opc_core::model::{
    CalculationInput, CalculationProfile, HourlyRate, Material, Printer, Workstep, WorkstepCategory,
};
use uuid::Uuid;

/// Lesen und Schreiben von Druckern.
pub trait PrinterRepository {
    /// Alle Drucker, alphabetisch nach Modellbezeichnung.
    fn list_printers(&self) -> StoreResult<Vec<Printer>>;

    /// Ein Drucker nach ID — `NotFound`, falls unbekannt.
    fn get_printer(&self, id: Uuid) -> StoreResult<Printer>;

    /// Legt einen Drucker an oder ersetzt einen bestehenden (ID entscheidet).
    fn save_printer(&self, printer: &Printer) -> StoreResult<()>;

    /// Löscht einen Drucker — `NotFound`, falls unbekannt.
    fn delete_printer(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben von Materialien.
pub trait MaterialRepository {
    /// Alle Materialien, alphabetisch nach Bezeichnung.
    fn list_materials(&self) -> StoreResult<Vec<Material>>;

    /// Ein Material nach ID — `NotFound`, falls unbekannt.
    fn get_material(&self, id: Uuid) -> StoreResult<Material>;

    /// Legt ein Material an oder ersetzt ein bestehendes.
    fn save_material(&self, material: &Material) -> StoreResult<()>;

    /// Löscht ein Material — `NotFound`, falls unbekannt.
    fn delete_material(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben von Arbeitsschritt-Kategorien.
pub trait WorkstepCategoryRepository {
    /// Alle Kategorien, alphabetisch nach Name.
    fn list_workstep_categories(&self) -> StoreResult<Vec<WorkstepCategory>>;

    /// Eine Kategorie nach ID — `NotFound`, falls unbekannt.
    fn get_workstep_category(&self, id: Uuid) -> StoreResult<WorkstepCategory>;

    /// Legt eine Kategorie an oder ersetzt eine bestehende.
    fn save_workstep_category(&self, category: &WorkstepCategory) -> StoreResult<()>;

    /// Löscht eine Kategorie — `NotFound`, falls unbekannt.
    fn delete_workstep_category(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben von Arbeitsschritten.
pub trait WorkstepRepository {
    /// Alle Arbeitsschritte, alphabetisch nach Name.
    fn list_worksteps(&self) -> StoreResult<Vec<Workstep>>;

    /// Ein Arbeitsschritt nach ID — `NotFound`, falls unbekannt.
    fn get_workstep(&self, id: Uuid) -> StoreResult<Workstep>;

    /// Legt einen Arbeitsschritt an oder ersetzt einen bestehenden.
    fn save_workstep(&self, workstep: &Workstep) -> StoreResult<()>;

    /// Löscht einen Arbeitsschritt — `NotFound`, falls unbekannt.
    fn delete_workstep(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben von Maschinenstundensätzen.
pub trait HourlyRateRepository {
    /// Alle Stundensätze, alphabetisch nach Name.
    fn list_hourly_rates(&self) -> StoreResult<Vec<HourlyRate>>;

    /// Ein Stundensatz nach ID — `NotFound`, falls unbekannt.
    fn get_hourly_rate(&self, id: Uuid) -> StoreResult<HourlyRate>;

    /// Legt einen Stundensatz an oder ersetzt einen bestehenden.
    fn save_hourly_rate(&self, rate: &HourlyRate) -> StoreResult<()>;

    /// Löscht einen Stundensatz — `NotFound`, falls unbekannt.
    fn delete_hourly_rate(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben von Kalkulationsprofilen.
pub trait ProfileRepository {
    /// Alle Profile, alphabetisch nach Name.
    fn list_calculation_profiles(&self) -> StoreResult<Vec<CalculationProfile>>;

    /// Ein Profil nach ID — `NotFound`, falls unbekannt.
    fn get_calculation_profile(&self, id: Uuid) -> StoreResult<CalculationProfile>;

    /// Legt ein Profil an oder ersetzt ein bestehendes.
    fn save_calculation_profile(&self, profile: &CalculationProfile) -> StoreResult<()>;

    /// Löscht ein Profil — `NotFound`, falls unbekannt.
    fn delete_calculation_profile(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben von Kalkulationen.
pub trait CalculationRepository {
    /// Kurzfassungen aller Kalkulationen, neueste zuerst.
    fn list_calculations(&self) -> StoreResult<Vec<CalculationSummary>>;

    /// Eine Kalkulation mit vollständigem Schnappschuss — `NotFound`, falls unbekannt.
    fn get_calculation(&self, id: Uuid) -> StoreResult<StoredCalculation>;

    /// Legt eine Kalkulation an oder ersetzt eine bestehende.
    ///
    /// `created_at` bleibt bei einem Ersetzen unverändert.
    fn save_calculation(&self, calculation: &CalculationInput) -> StoreResult<()>;

    /// Löscht eine Kalkulation samt ihrer Dateien — `NotFound`, falls unbekannt.
    fn delete_calculation(&self, id: Uuid) -> StoreResult<()>;
}

/// Lesen und Schreiben der Firmendaten (Singleton).
pub trait CompanyRepository {
    /// Die Firmendaten — leere Werte, wenn noch nichts gespeichert wurde.
    fn get_company_info(&self) -> StoreResult<CompanyInfo>;

    /// Speichert die Firmendaten (ersetzt den bisherigen Stand).
    fn save_company_info(&self, info: &CompanyInfo) -> StoreResult<()>;
}

/// Der vollständige Speicherport.
///
/// Der Port ist ein **Kompositum** aus den Repository-Traits. Ein Adapter
/// implementiert alle Teil-Traits; die Trait-Objektsicherheit erlaubt der
/// Anwendung, mit `Arc<dyn Store>` zu arbeiten, ohne das Backend zu kennen.
pub trait Store:
    PrinterRepository
    + MaterialRepository
    + WorkstepCategoryRepository
    + WorkstepRepository
    + HourlyRateRepository
    + ProfileRepository
    + CalculationRepository
    + CompanyRepository
    + Send
    + Sync
{
}

impl<T> Store for T where
    T: PrinterRepository
        + MaterialRepository
        + WorkstepCategoryRepository
        + WorkstepRepository
        + HourlyRateRepository
        + ProfileRepository
        + CalculationRepository
        + CompanyRepository
        + Send
        + Sync
{
}
