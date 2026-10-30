//! Der SQLite-Adapter — eine Implementierung des Speicherports.
//!
//! Alle Geldbeträge werden als **TEXT** gespeichert — SQLite kennt keinen
//! exakten Dezimaltyp, und `REAL` würde die Exaktheit aus `opc-core`
//! zerstören.

pub mod mapping;
pub mod migrations;

use crate::error::{StoreError, StoreResult};
use crate::port::{
    CalculationRepository, CompanyRepository, HourlyRateRepository, MaterialRepository,
    PrinterRepository, ProfileRepository, WorkstepCategoryRepository, WorkstepRepository,
};
use crate::record::{CalculationSummary, CompanyInfo, StoredCalculation};
use mapping::backend;
use opc_core::model::{
    CalculationInput, CalculationProfile, HourlyRate, Material, Printer, Workstep, WorkstepCategory,
};
use rusqlite::{Connection, OptionalExtension, params};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use uuid::Uuid;

/// Ein Store auf Basis einer SQLite-Datei.
///
/// Die Verbindung liegt hinter einem `Mutex`, damit der Store `Send + Sync`
/// ist und als Tauri-State gehalten werden kann (Spec 0005,
/// Akzeptanzkriterium 9).
pub struct SqliteStore {
    connection: Mutex<Connection>,
    path: PathBuf,
}

impl std::fmt::Debug for SqliteStore {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("SqliteStore")
            .field("path", &self.path)
            .finish()
    }
}

impl SqliteStore {
    /// Öffnet (oder legt an) eine Datenbankdatei und wendet die Migrationen an.
    ///
    /// Elterneister Verzeichnisse werden angelegt.
    pub fn open(path: impl AsRef<Path>) -> StoreResult<Self> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent()
            && !parent.as_os_str().is_empty()
        {
            std::fs::create_dir_all(parent).map_err(|error| StoreError::Backend {
                message: format!(
                    "Verzeichnis '{}' konnte nicht angelegt werden: {error}",
                    parent.display()
                ),
            })?;
        }

        prepare_database_file(&path)?;
        let connection = Connection::open(&path).map_err(|error| StoreError::Backend {
            message: format!(
                "Datenbank '{}' konnte nicht geöffnet werden: {error}",
                path.display()
            ),
        })?;
        Self::from_connection(connection, path)
    }

    /// Öffnet eine Datenbank **im Arbeitsspeicher** — für Tests und für
    /// das Ausprobieren ohne Datei.
    pub fn open_in_memory() -> StoreResult<Self> {
        let connection = Connection::open_in_memory().map_err(|error| StoreError::Backend {
            message: format!("In-Memory-Datenbank konnte nicht geöffnet werden: {error}"),
        })?;
        Self::from_connection(connection, PathBuf::from(":memory:"))
    }

    /// Baut den Store aus einer bestehenden Verbindung.
    fn from_connection(mut connection: Connection, path: PathBuf) -> StoreResult<Self> {
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(backend)?;
        connection
            .pragma_update(None, "foreign_keys", "ON")
            .map_err(backend)?;
        if path != Path::new(":memory:") {
            set_private_permissions(&path)?;
            // WAL erlaubt Lesen parallel zu einem Schreiber und reduziert
            // Lock-Fehler bei zwei geöffneten Instanzen. Manche Dateisysteme
            // (z. B. Netzwerkfreigaben) unterstützen WAL nicht; dann bleibt
            // SQLite beim bisherigen Journal-Modus und die App startet weiter.
            // Kein harter Fehler, wenn SQLite WAL nicht aktivieren kann
            // (typischerweise auf Netzwerkfreigaben): der bisherige bzw.
            // explizit angeforderte DELETE-Modus ist ein gültiger Fallback.
            if connection
                .query_row("PRAGMA journal_mode = WAL", [], |row| {
                    row.get::<_, String>(0)
                })
                .is_err()
            {
                let _ = connection.pragma_update(None, "journal_mode", "DELETE");
            }
            set_private_permissions_for_database(&path)?;
        }
        migrations::apply_migrations(&mut connection, &path)?;
        set_private_permissions_for_database(&path)?;
        Ok(Self {
            connection: Mutex::new(connection),
            path,
        })
    }

    /// Pfad der verwendeten Datenbankdatei.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Führt eine Operation mit der Verbindung aus.
    fn with_connection<T>(
        &self,
        operation: impl FnOnce(&Connection) -> StoreResult<T>,
    ) -> StoreResult<T> {
        let guard = self.connection.lock().map_err(|_| StoreError::Backend {
            message: "Datenbankverbindung ist gesperrt".to_string(),
        })?;
        operation(&guard)
    }

    /// Führt eine schreibende Operation mit der Verbindung aus.
    fn with_connection_mut<T>(
        &self,
        operation: impl FnOnce(&mut Connection) -> StoreResult<T>,
    ) -> StoreResult<T> {
        let mut guard = self.connection.lock().map_err(|_| StoreError::Backend {
            message: "Datenbankverbindung ist gesperrt".to_string(),
        })?;
        operation(&mut guard)
    }
}

/// Spaltenauswahl für Druckerzeilen (Reihenfolge wie `row_to_printer`).
const PRINTER_COLUMNS: &str = "id, model, manufacturer, process, material_family, \
     power_watts, build_width_mm, build_depth_mm, build_height_mm, purchase_price, \
     hourly_rate, nozzle_wear_cost, build_plate_wear_cost, material_change_cost, properties";

/// Spaltenauswahl für Materialzeilen.
const MATERIAL_COLUMNS: &str = "id, name, material_type, family, manufacturer, shop_link, \
     density_g_cm3, package_size, unit, price, properties";

/// Spaltenauswahl für Arbeitsschrittzeilen (inkl. Kategorie und Kategoriefarbe).
const WORKSTEP_COLUMNS: &str = "w.id, w.name, w.category_id, c.name, c.color, \
     w.calculation_type, w.price, w.quantity, w.duration_hours, w.timing";

/// Spaltenauswahl für Stundensatzzeilen.
const HOURLY_RATE_COLUMNS: &str = "id, name, time_basis, machine_hours, replacement_cost, \
     service_life_years, interest_rate_percent, maintenance_fixed, rent_fixed, \
     electricity_fixed, additional_fixed, maintenance_variable, electricity_variable, \
     additional_variable, fixed_rate_override";

/// Spaltenauswahl für Profilzeilen.
const PROFILE_COLUMNS: &str = "id, name, fail_rate_percent, tax_rate_percent, margin_percent, \
     handling_fee, handling_fee_scope, energy_price_per_kwh, apply_energy_costs, \
     power_level_percent, combine_materials, multiply_print_time_with_quantity, \
     print_time_factor, exclude_machine_from_margin, exclude_material_from_margin, \
     exclude_worksteps_from_margin";

impl PrinterRepository for SqliteStore {
    fn list_printers(&self) -> StoreResult<Vec<Printer>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {PRINTER_COLUMNS} FROM printers ORDER BY model"
                ))
                .map_err(backend)?;
            let rows = statement
                .query_map([], mapping::row_to_printer)
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_printer(&self, id: Uuid) -> StoreResult<Printer> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    &format!("SELECT {PRINTER_COLUMNS} FROM printers WHERE id = ?1"),
                    params![id.to_string()],
                    mapping::row_to_printer,
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Drucker",
                    id,
                })
        })
    }

    fn save_printer(&self, printer: &Printer) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let now = mapping::now_iso8601();
            let created = existing_created_at(connection, "printers", &printer.id)?
                .unwrap_or_else(|| now.clone());
            let build_volume =
                printer
                    .build_volume_mm3()
                    .map_err(|error| StoreError::InvalidValue {
                        message: error.to_string(),
                    })?;
            connection
                .execute(
                    "INSERT INTO printers (id, model, manufacturer, process, material_family,
                         power_watts, build_volume_mm3, build_width_mm, build_depth_mm,
                         build_height_mm, purchase_price, hourly_rate, nozzle_wear_cost,
                         build_plate_wear_cost, material_change_cost, properties,
                         created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14,
                         ?15, ?16, ?17, ?18)
                     ON CONFLICT (id) DO UPDATE SET
                         model = excluded.model,
                         manufacturer = excluded.manufacturer,
                         process = excluded.process,
                         material_family = excluded.material_family,
                         power_watts = excluded.power_watts,
                         build_volume_mm3 = excluded.build_volume_mm3,
                         build_width_mm = excluded.build_width_mm,
                         build_depth_mm = excluded.build_depth_mm,
                         build_height_mm = excluded.build_height_mm,
                         purchase_price = excluded.purchase_price,
                         hourly_rate = excluded.hourly_rate,
                         nozzle_wear_cost = excluded.nozzle_wear_cost,
                         build_plate_wear_cost = excluded.build_plate_wear_cost,
                         material_change_cost = excluded.material_change_cost,
                         properties = excluded.properties,
                         updated_at = excluded.updated_at",
                    params![
                        printer.id.to_string(),
                        printer.model,
                        printer.manufacturer,
                        mapping::enum_to_text(&printer.process)?,
                        mapping::enum_to_text(&printer.material_family)?,
                        mapping::decimal_to_text(printer.power_watts),
                        mapping::decimal_to_text(build_volume),
                        mapping::decimal_to_text(printer.build_width_mm),
                        mapping::decimal_to_text(printer.build_depth_mm),
                        mapping::decimal_to_text(printer.build_height_mm),
                        mapping::decimal_to_text(printer.purchase_price),
                        printer.hourly_rate.map(mapping::decimal_to_text),
                        printer.nozzle_wear_cost.map(mapping::decimal_to_text),
                        printer.build_plate_wear_cost.map(mapping::decimal_to_text),
                        printer.material_change_cost.map(mapping::decimal_to_text),
                        mapping::properties_to_text(&printer.properties),
                        created,
                        now,
                    ],
                )
                .map_err(backend)?;
            Ok(())
        })
    }

    fn delete_printer(&self, id: Uuid) -> StoreResult<()> {
        delete_by_id(self, "printers", "Drucker", id)
    }
}

impl MaterialRepository for SqliteStore {
    fn list_materials(&self) -> StoreResult<Vec<Material>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {MATERIAL_COLUMNS} FROM materials ORDER BY name"
                ))
                .map_err(backend)?;
            let rows = statement
                .query_map([], mapping::row_to_material)
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_material(&self, id: Uuid) -> StoreResult<Material> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    &format!("SELECT {MATERIAL_COLUMNS} FROM materials WHERE id = ?1"),
                    params![id.to_string()],
                    mapping::row_to_material,
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Material",
                    id,
                })
        })
    }

    fn save_material(&self, material: &Material) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let now = mapping::now_iso8601();
            let created = existing_created_at(connection, "materials", &material.id)?
                .unwrap_or_else(|| now.clone());
            connection
                .execute(
                    "INSERT INTO materials (id, name, material_type, family, manufacturer,
                         shop_link, density_g_cm3, package_size, unit, price, properties,
                         created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                     ON CONFLICT (id) DO UPDATE SET
                         name = excluded.name,
                         material_type = excluded.material_type,
                         family = excluded.family,
                         manufacturer = excluded.manufacturer,
                         shop_link = excluded.shop_link,
                         density_g_cm3 = excluded.density_g_cm3,
                         package_size = excluded.package_size,
                         unit = excluded.unit,
                         price = excluded.price,
                         properties = excluded.properties,
                         updated_at = excluded.updated_at",
                    params![
                        material.id.to_string(),
                        material.name,
                        material.material_type,
                        mapping::enum_to_text(&material.family)?,
                        material.manufacturer,
                        material.shop_link,
                        mapping::decimal_to_text(material.density_g_cm3),
                        mapping::decimal_to_text(material.package_size),
                        mapping::enum_to_text(&material.unit)?,
                        mapping::decimal_to_text(material.price),
                        mapping::properties_to_text(&material.properties),
                        created,
                        now,
                    ],
                )
                .map_err(backend)?;
            Ok(())
        })
    }

    fn delete_material(&self, id: Uuid) -> StoreResult<()> {
        delete_by_id(self, "materials", "Material", id)
    }
}

impl WorkstepCategoryRepository for SqliteStore {
    fn list_workstep_categories(&self) -> StoreResult<Vec<WorkstepCategory>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare("SELECT id, name, color FROM workstep_categories ORDER BY name")
                .map_err(backend)?;
            let rows = statement
                .query_map([], mapping::row_to_category)
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_workstep_category(&self, id: Uuid) -> StoreResult<WorkstepCategory> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    "SELECT id, name, color FROM workstep_categories WHERE id = ?1",
                    params![id.to_string()],
                    mapping::row_to_category,
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Arbeitsschritt-Kategorie",
                    id,
                })
        })
    }

    fn save_workstep_category(&self, category: &WorkstepCategory) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            connection
                .execute(
                    "INSERT INTO workstep_categories (id, name, color) VALUES (?1, ?2, ?3)
                     ON CONFLICT (id) DO UPDATE SET
                         name = excluded.name,
                         color = excluded.color",
                    params![category.id.to_string(), category.name, category.color],
                )
                .map_err(backend)?;
            Ok(())
        })
    }

    fn delete_workstep_category(&self, id: Uuid) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let referenced: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM worksteps WHERE category_id = ?1",
                    params![id.to_string()],
                    |row| row.get(0),
                )
                .map_err(backend)?;
            if referenced > 0 {
                return Err(StoreError::InUse {
                    entity: "Arbeitsschritt-Kategorie",
                    id,
                });
            }
            let deleted = connection
                .execute(
                    "DELETE FROM workstep_categories WHERE id = ?1",
                    params![id.to_string()],
                )
                .map_err(backend)?;
            if deleted == 0 {
                return Err(StoreError::NotFound {
                    entity: "Arbeitsschritt-Kategorie",
                    id,
                });
            }
            Ok(())
        })
    }
}

impl WorkstepRepository for SqliteStore {
    fn list_worksteps(&self) -> StoreResult<Vec<Workstep>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {WORKSTEP_COLUMNS} FROM worksteps w
                     JOIN workstep_categories c ON c.id = w.category_id
                     ORDER BY w.name"
                ))
                .map_err(backend)?;
            let rows = statement
                .query_map([], mapping::row_to_workstep)
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_workstep(&self, id: Uuid) -> StoreResult<Workstep> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    &format!(
                        "SELECT {WORKSTEP_COLUMNS} FROM worksteps w
                         JOIN workstep_categories c ON c.id = w.category_id
                         WHERE w.id = ?1"
                    ),
                    params![id.to_string()],
                    mapping::row_to_workstep,
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Arbeitsschritt",
                    id,
                })
        })
    }

    fn save_workstep(&self, workstep: &Workstep) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let now = mapping::now_iso8601();
            let created = existing_created_at(connection, "worksteps", &workstep.id)?
                .unwrap_or_else(|| now.clone());
            // Die Kategorie muss existieren — sonst wäre die Fremdschlüssel-
            //bedingung die einzige Instanz, die den Fehler auslöst.
            let category_exists: i64 = connection
                .query_row(
                    "SELECT COUNT(*) FROM workstep_categories WHERE id = ?1",
                    params![workstep.category.id.to_string()],
                    |row| row.get(0),
                )
                .map_err(backend)?;
            if category_exists == 0 {
                return Err(StoreError::NotFound {
                    entity: "Arbeitsschritt-Kategorie",
                    id: workstep.category.id,
                });
            }
            connection
                .execute(
                    "INSERT INTO worksteps (id, name, category_id, calculation_type, price,
                         quantity, duration_hours, timing, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                     ON CONFLICT (id) DO UPDATE SET
                         name = excluded.name,
                         category_id = excluded.category_id,
                         calculation_type = excluded.calculation_type,
                         price = excluded.price,
                         quantity = excluded.quantity,
                         duration_hours = excluded.duration_hours,
                         timing = excluded.timing,
                         updated_at = excluded.updated_at",
                    params![
                        workstep.id.to_string(),
                        workstep.name,
                        workstep.category.id.to_string(),
                        mapping::enum_to_text(&workstep.calculation_type)?,
                        mapping::decimal_to_text(workstep.price),
                        mapping::decimal_to_text(workstep.quantity),
                        mapping::decimal_to_text(workstep.duration_hours),
                        mapping::enum_to_text(&workstep.timing)?,
                        created,
                        now,
                    ],
                )
                .map_err(backend)?;
            Ok(())
        })
    }

    fn delete_workstep(&self, id: Uuid) -> StoreResult<()> {
        delete_by_id(self, "worksteps", "Arbeitsschritt", id)
    }
}

impl HourlyRateRepository for SqliteStore {
    fn list_hourly_rates(&self) -> StoreResult<Vec<HourlyRate>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {HOURLY_RATE_COLUMNS} FROM hourly_rates ORDER BY name"
                ))
                .map_err(backend)?;
            let rows = statement
                .query_map([], mapping::row_to_hourly_rate)
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_hourly_rate(&self, id: Uuid) -> StoreResult<HourlyRate> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    &format!("SELECT {HOURLY_RATE_COLUMNS} FROM hourly_rates WHERE id = ?1"),
                    params![id.to_string()],
                    mapping::row_to_hourly_rate,
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Maschinenstundensatz",
                    id,
                })
        })
    }

    fn save_hourly_rate(&self, rate: &HourlyRate) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let now = mapping::now_iso8601();
            let created = existing_created_at(connection, "hourly_rates", &rate.id)?
                .unwrap_or_else(|| now.clone());
            connection
                .execute(
                    "INSERT INTO hourly_rates (id, name, time_basis, machine_hours,
                         replacement_cost, service_life_years, interest_rate_percent,
                         maintenance_fixed, rent_fixed, electricity_fixed, additional_fixed,
                         maintenance_variable, electricity_variable, additional_variable,
                         fixed_rate_override, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
                     ON CONFLICT (id) DO UPDATE SET
                         name = excluded.name,
                         time_basis = excluded.time_basis,
                         machine_hours = excluded.machine_hours,
                         replacement_cost = excluded.replacement_cost,
                         service_life_years = excluded.service_life_years,
                         interest_rate_percent = excluded.interest_rate_percent,
                         maintenance_fixed = excluded.maintenance_fixed,
                         rent_fixed = excluded.rent_fixed,
                         electricity_fixed = excluded.electricity_fixed,
                         additional_fixed = excluded.additional_fixed,
                         maintenance_variable = excluded.maintenance_variable,
                         electricity_variable = excluded.electricity_variable,
                         additional_variable = excluded.additional_variable,
                         fixed_rate_override = excluded.fixed_rate_override,
                         updated_at = excluded.updated_at",
                    params![
                        rate.id.to_string(),
                        rate.name,
                        mapping::enum_to_text(&rate.time_basis)?,
                        mapping::decimal_to_text(rate.machine_hours),
                        mapping::decimal_to_text(rate.replacement_cost),
                        mapping::decimal_to_text(rate.service_life_years),
                        mapping::decimal_to_text(rate.interest_rate_percent),
                        mapping::decimal_to_text(rate.maintenance_fixed),
                        mapping::decimal_to_text(rate.rent_fixed),
                        mapping::decimal_to_text(rate.electricity_fixed),
                        mapping::decimal_to_text(rate.additional_fixed),
                        mapping::decimal_to_text(rate.maintenance_variable),
                        mapping::decimal_to_text(rate.electricity_variable),
                        mapping::decimal_to_text(rate.additional_variable),
                        rate.fixed_rate_override.map(mapping::decimal_to_text),
                        created,
                        now,
                    ],
                )
                .map_err(backend)?;
            Ok(())
        })
    }

    fn delete_hourly_rate(&self, id: Uuid) -> StoreResult<()> {
        delete_by_id(self, "hourly_rates", "Maschinenstundensatz", id)
    }
}

impl ProfileRepository for SqliteStore {
    fn list_calculation_profiles(&self) -> StoreResult<Vec<CalculationProfile>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare(&format!(
                    "SELECT {PROFILE_COLUMNS} FROM calculation_profiles ORDER BY name"
                ))
                .map_err(backend)?;
            let rows = statement
                .query_map([], mapping::row_to_profile)
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_calculation_profile(&self, id: Uuid) -> StoreResult<CalculationProfile> {
        self.with_connection(|connection| {
            connection
                .query_row(
                    &format!("SELECT {PROFILE_COLUMNS} FROM calculation_profiles WHERE id = ?1"),
                    params![id.to_string()],
                    mapping::row_to_profile,
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Kalkulationsprofil",
                    id,
                })
        })
    }

    fn save_calculation_profile(&self, profile: &CalculationProfile) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let now = mapping::now_iso8601();
            let created = existing_created_at(connection, "calculation_profiles", &profile.id)?
                .unwrap_or_else(|| now.clone());
            connection
                .execute(
                    "INSERT INTO calculation_profiles (id, name, fail_rate_percent,
                         tax_rate_percent, margin_percent, handling_fee, handling_fee_scope,
                         energy_price_per_kwh, apply_energy_costs, power_level_percent,
                         combine_materials, multiply_print_time_with_quantity, print_time_factor,
                         exclude_machine_from_margin, exclude_material_from_margin,
                         exclude_worksteps_from_margin, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
                     ON CONFLICT (id) DO UPDATE SET
                         name = excluded.name,
                         fail_rate_percent = excluded.fail_rate_percent,
                         tax_rate_percent = excluded.tax_rate_percent,
                         margin_percent = excluded.margin_percent,
                         handling_fee = excluded.handling_fee,
                         handling_fee_scope = excluded.handling_fee_scope,
                         energy_price_per_kwh = excluded.energy_price_per_kwh,
                         apply_energy_costs = excluded.apply_energy_costs,
                         power_level_percent = excluded.power_level_percent,
                         combine_materials = excluded.combine_materials,
                         multiply_print_time_with_quantity = excluded.multiply_print_time_with_quantity,
                         print_time_factor = excluded.print_time_factor,
                         exclude_machine_from_margin = excluded.exclude_machine_from_margin,
                         exclude_material_from_margin = excluded.exclude_material_from_margin,
                         exclude_worksteps_from_margin = excluded.exclude_worksteps_from_margin,
                         updated_at = excluded.updated_at",
                    params![
                        profile.id.to_string(),
                        profile.name,
                        mapping::decimal_to_text(profile.fail_rate_percent),
                        mapping::decimal_to_text(profile.tax_rate_percent),
                        mapping::decimal_to_text(profile.margin_percent),
                        mapping::decimal_to_text(profile.handling_fee),
                        mapping::enum_to_text(&profile.handling_fee_scope)?,
                        mapping::decimal_to_text(profile.energy_price_per_kwh),
                        mapping::bool_to_int(profile.apply_energy_costs),
                        mapping::decimal_to_text(profile.power_level_percent),
                        mapping::bool_to_int(profile.combine_materials),
                        mapping::bool_to_int(profile.multiply_print_time_with_quantity),
                        mapping::decimal_to_text(profile.print_time_factor),
                        mapping::bool_to_int(profile.exclude_machine_from_margin),
                        mapping::bool_to_int(profile.exclude_material_from_margin),
                        mapping::bool_to_int(profile.exclude_worksteps_from_margin),
                        created,
                        now,
                    ],
                )
                .map_err(backend)?;
            Ok(())
        })
    }

    fn delete_calculation_profile(&self, id: Uuid) -> StoreResult<()> {
        delete_by_id(self, "calculation_profiles", "Kalkulationsprofil", id)
    }
}

impl CalculationRepository for SqliteStore {
    fn list_calculations(&self) -> StoreResult<Vec<CalculationSummary>> {
        self.with_connection(|connection| {
            let mut statement = connection
                .prepare(
                    "SELECT c.id, c.project_name, c.created_at, c.updated_at,
                            COUNT(f.id) AS file_count,
                            COALESCE(SUM(f.quantity), 0) AS total_quantity
                     FROM calculations c
                     LEFT JOIN calculation_files f ON f.calculation_id = c.id
                     GROUP BY c.id, c.project_name, c.created_at, c.updated_at
                     ORDER BY c.updated_at DESC, c.id ASC",
                )
                .map_err(backend)?;
            let rows = statement
                .query_map([], |row| {
                    Ok(CalculationSummary {
                        id: row.get(0)?,
                        project_name: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                        file_count: u32::try_from(row.get::<_, i64>(4)?).unwrap_or(u32::MAX),
                        total_quantity: u32::try_from(row.get::<_, i64>(5)?).unwrap_or(u32::MAX),
                    })
                })
                .map_err(backend)?;
            collect(rows)
        })
    }

    fn get_calculation(&self, id: Uuid) -> StoreResult<StoredCalculation> {
        self.with_connection(|connection| {
            let row = connection
                .query_row(
                    "SELECT id, project_name, created_at, updated_at, document
                     FROM calculations WHERE id = ?1",
                    params![id.to_string()],
                    |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, String>(1)?,
                            row.get::<_, String>(2)?,
                            row.get::<_, String>(3)?,
                            row.get::<_, String>(4)?,
                        ))
                    },
                )
                .optional()
                .map_err(backend)?
                .ok_or(StoreError::NotFound {
                    entity: "Kalkulation",
                    id,
                })?;

            let document = serde_json::from_str::<CalculationInput>(&row.4).map_err(|error| {
                StoreError::Corrupt {
                    message: format!("Kalkulationsdokument ist unlesbar: {error}"),
                }
            })?;

            Ok(StoredCalculation {
                id: row.0,
                project_name: row.1,
                created_at: row.2,
                updated_at: row.3,
                document,
            })
        })
    }

    fn save_calculation(&self, calculation: &CalculationInput) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            crate::validation::ensure_unique_file_ids(calculation)?;
            let now = mapping::now_iso8601();
            let created =
                existing_created_at(connection, "calculations", &calculation.id)?.unwrap_or_else(|| now.clone());
            let document = serde_json::to_string(calculation).map_err(|error| StoreError::Corrupt {
                message: format!("Kalkulation konnte nicht serialisiert werden: {error}"),
            })?;

            let transaction = connection.transaction().map_err(backend)?;

            transaction
                .execute(
                    "INSERT INTO calculations (id, project_name, notes, created_at, updated_at, document)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                     ON CONFLICT (id) DO UPDATE SET
                         project_name = excluded.project_name,
                         notes = excluded.notes,
                         updated_at = excluded.updated_at,
                         document = excluded.document",
                    params![
                        calculation.id.to_string(),
                        calculation.project_name,
                        calculation.notes,
                        created,
                        now,
                        document,
                    ],
                )
                .map_err(backend)?;

            transaction
                .execute(
                    "DELETE FROM calculation_files WHERE calculation_id = ?1",
                    params![calculation.id.to_string()],
                )
                .map_err(backend)?;

            for (order, file) in calculation.files.iter().enumerate() {
                transaction
                    .execute(
                        "INSERT INTO calculation_files (id, calculation_id, file_name, quantity,
                             print_time_hours, volume_cm3, weight_g, material_changes, sort_order)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        params![
                            file.id.to_string(),
                            calculation.id.to_string(),
                            file.file_name,
                            i64::from(file.quantity),
                            mapping::decimal_to_text(file.print_time_hours),
                            file.volume_cm3.map(mapping::decimal_to_text),
                            file.weight_g.map(mapping::decimal_to_text),
                            i64::from(file.material_changes),
                            order as i64,
                        ],
                    )
                    .map_err(backend)?;
            }

            transaction.commit().map_err(backend)?;
            Ok(())
        })
    }

    fn delete_calculation(&self, id: Uuid) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            let deleted = connection
                .execute(
                    "DELETE FROM calculations WHERE id = ?1",
                    params![id.to_string()],
                )
                .map_err(backend)?;
            if deleted == 0 {
                return Err(StoreError::NotFound {
                    entity: "Kalkulation",
                    id,
                });
            }
            Ok(())
        })
    }
}

impl CompanyRepository for SqliteStore {
    fn get_company_info(&self) -> StoreResult<CompanyInfo> {
        self.with_connection(|connection| {
            let row: Option<(String, String, String, String, Option<String>)> = connection
                .query_row(
                    "SELECT name, street, zip_city, email, currency FROM company_info WHERE id = 1",
                    [],
                    |row| {
                        Ok((
                            row.get(0)?,
                            row.get(1)?,
                            row.get(2)?,
                            row.get(3)?,
                            row.get(4)?,
                        ))
                    },
                )
                .optional()
                .map_err(backend)?;
            Ok(row
                .map(|(name, street, zip_city, email, currency)| CompanyInfo {
                    name,
                    street,
                    zip_city,
                    email,
                    currency: currency.unwrap_or_else(crate::record::default_currency),
                })
                .unwrap_or_default())
        })
    }

    fn save_company_info(&self, info: &CompanyInfo) -> StoreResult<()> {
        self.with_connection_mut(|connection| {
            connection
                .execute(
                    "INSERT INTO company_info (id, name, street, zip_city, email, currency)
                     VALUES (1, ?1, ?2, ?3, ?4, ?5)
                     ON CONFLICT (id) DO UPDATE SET
                         name = excluded.name,
                         street = excluded.street,
                         zip_city = excluded.zip_city,
                         email = excluded.email,
                         currency = excluded.currency",
                    params![
                        info.name,
                        info.street,
                        info.zip_city,
                        info.email,
                        info.currency
                    ],
                )
                .map_err(backend)?;
            Ok(())
        })
    }
}

/// Löscht einen Datensatz und meldet `NotFound`, falls nichts betroffen war.
fn delete_by_id(
    store: &SqliteStore,
    table: &str,
    entity: &'static str,
    id: Uuid,
) -> StoreResult<()> {
    store.with_connection_mut(|connection| {
        let deleted = connection
            .execute(
                &format!("DELETE FROM {table} WHERE id = ?1"),
                params![id.to_string()],
            )
            .map_err(backend)?;
        if deleted == 0 {
            return Err(StoreError::NotFound { entity, id });
        }
        Ok(())
    })
}

/// Liest den Erstellungszeitpunkt eines Datensatzes, falls er existiert.
fn existing_created_at(
    connection: &Connection,
    table: &str,
    id: &Uuid,
) -> StoreResult<Option<String>> {
    connection
        .query_row(
            &format!("SELECT created_at FROM {table} WHERE id = ?1"),
            params![id.to_string()],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(backend)
}

/// Sammelt alle Zeilen eines Ergebnisses.
fn collect<T>(rows: impl Iterator<Item = rusqlite::Result<T>>) -> StoreResult<Vec<T>> {
    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(backend)?);
    }
    Ok(items)
}

/// Legt eine neue Datenbankdatei auf Unix direkt mit `0600` an.
#[cfg(unix)]
fn prepare_database_file(path: &Path) -> StoreResult<()> {
    use std::os::unix::fs::OpenOptionsExt;

    match std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
    {
        Ok(_) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
        Err(error) => Err(StoreError::Backend {
            message: format!(
                "Datenbank '{}' konnte nicht angelegt werden: {error}",
                path.display()
            ),
        }),
    }
}

/// Auf Nicht-Unix-Systemen gibt es keine POSIX-Dateirechte.
#[cfg(not(unix))]
fn prepare_database_file(_path: &Path) -> StoreResult<()> {
    Ok(())
}

/// Setzt auf Unix restriktive Dateirechte für die lokale Datenbank.
///
/// Fehlende Rechteunterstützung ist kein Startfehler: Netzwerkfreigaben und
/// manche Sonderdateisysteme erlauben kein `chmod`. Die Anwendung bleibt
/// nutzbar, statt eine zuvor funktionierende Datenbank zu blockieren.
#[cfg(unix)]
fn set_private_permissions(path: &Path) -> StoreResult<()> {
    use std::os::unix::fs::PermissionsExt;

    if path == Path::new(":memory:") {
        return Ok(());
    }
    match std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)) {
        Ok(()) => Ok(()),
        Err(error)
            if matches!(
                error.kind(),
                std::io::ErrorKind::NotFound
                    | std::io::ErrorKind::PermissionDenied
                    | std::io::ErrorKind::Unsupported
            ) =>
        {
            Ok(())
        }
        Err(error) => Err(StoreError::Backend {
            message: format!(
                "Rechte der Datenbank '{}' konnten nicht gesetzt werden: {error}",
                path.display()
            ),
        }),
    }
}

/// Setzt die Dateirechte der Datenbank und ihrer WAL-Sidecars (`-wal`, `-shm`).
///
/// SQLite legt die Sidecars mit der Prozess-Umask an; ohne diesen Schritt
/// bleiben sie typischerweise `0644`, obwohl die Hauptdatei `0600` ist.
#[cfg(unix)]
fn set_private_permissions_for_database(path: &Path) -> StoreResult<()> {
    if path == Path::new(":memory:") {
        return Ok(());
    }
    set_private_permissions(path)?;
    for suffix in ["-wal", "-shm"] {
        let mut sidecar = std::ffi::OsString::from(path.as_os_str());
        sidecar.push(suffix);
        set_private_permissions(Path::new(&sidecar))?;
    }
    Ok(())
}

/// Auf Nicht-Unix-Systemen gibt es keine POSIX-Dateirechte.
#[cfg(not(unix))]
fn set_private_permissions(_path: &Path) -> StoreResult<()> {
    Ok(())
}

/// Auf Nicht-Unix-Systemen gibt es keine POSIX-Dateirechte.
#[cfg(not(unix))]
fn set_private_permissions_for_database(_path: &Path) -> StoreResult<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::SqliteStore;

    #[test]
    fn datei_datenbank_nutzt_wal_und_private_rechte() {
        let directory = tempfile::tempdir().expect("Temp-Verzeichnis");
        let path = directory.path().join("test.db");
        let store = SqliteStore::open(&path).expect("Datenbank muss öffnen");

        {
            let connection = store.connection.lock().expect("Verbindung");
            let mode: String = connection
                .query_row("PRAGMA journal_mode", [], |row| row.get(0))
                .expect("journal_mode");
            assert_eq!(mode.to_ascii_lowercase(), "wal");
            let timeout: i64 = connection
                .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
                .expect("busy_timeout");
            assert!(timeout >= 5000);
            connection
                .execute_batch("CREATE TABLE IF NOT EXISTS permission_probe (id INTEGER);")
                .expect("Schreibzugriff");
        }

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            for suffix in ["", "-wal", "-shm"] {
                let mut sidecar = std::ffi::OsString::from(path.as_os_str());
                sidecar.push(suffix);
                let sidecar = std::path::Path::new(&sidecar);
                let mode = std::fs::metadata(sidecar)
                    .expect("Datei-Metadaten")
                    .permissions()
                    .mode()
                    & 0o777;
                assert_eq!(mode, 0o600, "Rechte für {suffix:?} sind nicht privat");
            }
        }
    }
}
