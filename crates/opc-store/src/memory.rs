//! Ein In-Memory-Adapter — die zweite Implementierung des Ports.
//!
//! Der Adapter existiert aus zwei Gründen:
//!
//! 1. Tests laufen ohne Datenbankdatei.
//! 2. Die Austauschbarkeit des Backends wird **bewiesen**, nicht behauptet:
//!    dieselbe Testsuite läuft gegen diesen Adapter und gegen den
//!    SQLite-Adapter (Spec 0005, Akzeptanzkriterium 4).
//!
//! Das Verhalten entspricht dem SQLite-Adapter: gleiche Sortierung, gleiche
//! Zeitstempel-Semantik, gleiche Fehlerfälle.

use crate::error::{StoreError, StoreResult};
use crate::port::{
    CalculationRepository, HourlyRateRepository, MaterialRepository, PrinterRepository,
    ProfileRepository, WorkstepCategoryRepository, WorkstepRepository,
};
use crate::record::{CalculationSummary, StoredCalculation};
use chrono::{SecondsFormat, Utc};
use opc_core::model::{
    CalculationInput, CalculationProfile, HourlyRate, Material, Printer, Workstep, WorkstepCategory,
};
use std::collections::BTreeMap;
use std::sync::Mutex;
use uuid::Uuid;

/// Zeitstempel eines Datensatzes.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Timestamps {
    created_at: String,
    updated_at: String,
}

/// Eine Tabelle von Datensätzen mit ihren Zeitstempeln.
#[derive(Debug)]
struct Table<T> {
    items: BTreeMap<Uuid, T>,
    timestamps: BTreeMap<Uuid, Timestamps>,
}

impl<T> Default for Table<T> {
    fn default() -> Self {
        Self {
            items: BTreeMap::new(),
            timestamps: BTreeMap::new(),
        }
    }
}

impl<T> Table<T> {
    /// Legt einen Datensatz an oder ersetzt einen bestehenden.
    ///
    /// `created_at` bleibt bei einem Ersetzen unverändert, `updated_at` wird
    /// immer neu gesetzt.
    fn upsert(&mut self, id: Uuid, value: T) -> Timestamps {
        let now = now_iso8601();
        let created_at = self
            .timestamps
            .get(&id)
            .map(|timestamps| timestamps.created_at.clone())
            .unwrap_or_else(|| now.clone());
        let timestamps = Timestamps {
            created_at: created_at.clone(),
            updated_at: now,
        };
        self.timestamps.insert(id, timestamps.clone());
        self.items.insert(id, value);
        timestamps
    }

    /// Ein Datensatz nach ID.
    fn get(&self, id: Uuid) -> Option<&T> {
        self.items.get(&id)
    }

    /// Entfernt einen Datensatz — `false`, wenn es ihn nicht gab.
    fn remove(&mut self, id: Uuid) -> bool {
        self.timestamps.remove(&id);
        self.items.remove(&id).is_some()
    }

    /// Alle Datensätze, unsortiert.
    fn values(&self) -> Vec<&T> {
        self.items.values().collect()
    }

    /// Ob ein Datensatz existiert.
    fn contains(&self, id: Uuid) -> bool {
        self.items.contains_key(&id)
    }
}

/// Alle Daten des In-Memory-Stores.
#[derive(Debug, Default)]
struct MemoryData {
    printers: Table<Printer>,
    materials: Table<Material>,
    categories: Table<WorkstepCategory>,
    worksteps: Table<Workstep>,
    hourly_rates: Table<HourlyRate>,
    profiles: Table<CalculationProfile>,
    calculations: Table<StoredCalculation>,
}

/// Ein Store, der seine Daten im Arbeitsspeicher hält.
#[derive(Debug, Default)]
pub struct MemoryStore {
    data: Mutex<MemoryData>,
}

impl MemoryStore {
    /// Erzeugt einen leeren Store.
    pub fn new() -> Self {
        Self::default()
    }

    /// Führt eine Operation mit den Daten aus.
    fn with_data<T>(
        &self,
        operation: impl FnOnce(&mut MemoryData) -> StoreResult<T>,
    ) -> StoreResult<T> {
        let mut guard = self.data.lock().map_err(|_| StoreError::Backend {
            message: "Speicher ist gesperrt".to_string(),
        })?;
        operation(&mut guard)
    }
}

/// Aktueller Zeitpunkt als ISO-8601-String mit UTC.
fn now_iso8601() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

impl PrinterRepository for MemoryStore {
    fn list_printers(&self) -> StoreResult<Vec<Printer>> {
        self.with_data(|data| {
            let mut printers = data
                .printers
                .values()
                .into_iter()
                .cloned()
                .collect::<Vec<_>>();
            printers.sort_by(|a, b| a.model.cmp(&b.model));
            Ok(printers)
        })
    }

    fn get_printer(&self, id: Uuid) -> StoreResult<Printer> {
        self.with_data(|data| {
            data.printers.get(id).cloned().ok_or(StoreError::NotFound {
                entity: "Drucker",
                id,
            })
        })
    }

    fn save_printer(&self, printer: &Printer) -> StoreResult<()> {
        self.with_data(|data| {
            data.printers.upsert(printer.id, printer.clone());
            Ok(())
        })
    }

    fn delete_printer(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            if data.printers.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Drucker",
                    id,
                })
            }
        })
    }
}

impl MaterialRepository for MemoryStore {
    fn list_materials(&self) -> StoreResult<Vec<Material>> {
        self.with_data(|data| {
            let mut materials = data
                .materials
                .values()
                .into_iter()
                .cloned()
                .collect::<Vec<_>>();
            materials.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(materials)
        })
    }

    fn get_material(&self, id: Uuid) -> StoreResult<Material> {
        self.with_data(|data| {
            data.materials.get(id).cloned().ok_or(StoreError::NotFound {
                entity: "Material",
                id,
            })
        })
    }

    fn save_material(&self, material: &Material) -> StoreResult<()> {
        self.with_data(|data| {
            data.materials.upsert(material.id, material.clone());
            Ok(())
        })
    }

    fn delete_material(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            if data.materials.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Material",
                    id,
                })
            }
        })
    }
}

impl WorkstepCategoryRepository for MemoryStore {
    fn list_workstep_categories(&self) -> StoreResult<Vec<WorkstepCategory>> {
        self.with_data(|data| {
            let mut categories = data
                .categories
                .values()
                .into_iter()
                .cloned()
                .collect::<Vec<_>>();
            categories.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(categories)
        })
    }

    fn get_workstep_category(&self, id: Uuid) -> StoreResult<WorkstepCategory> {
        self.with_data(|data| {
            data.categories
                .get(id)
                .cloned()
                .ok_or(StoreError::NotFound {
                    entity: "Arbeitsschritt-Kategorie",
                    id,
                })
        })
    }

    fn save_workstep_category(&self, category: &WorkstepCategory) -> StoreResult<()> {
        self.with_data(|data| {
            data.categories.upsert(category.id, category.clone());
            Ok(())
        })
    }

    fn delete_workstep_category(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            let referenced = data
                .worksteps
                .values()
                .iter()
                .any(|workstep| workstep.category.id == id);
            if referenced {
                return Err(StoreError::InUse {
                    entity: "Arbeitsschritt-Kategorie",
                    id,
                });
            }
            if data.categories.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Arbeitsschritt-Kategorie",
                    id,
                })
            }
        })
    }
}

impl WorkstepRepository for MemoryStore {
    fn list_worksteps(&self) -> StoreResult<Vec<Workstep>> {
        self.with_data(|data| {
            let mut worksteps = data
                .worksteps
                .values()
                .into_iter()
                .cloned()
                .collect::<Vec<_>>();
            worksteps.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(worksteps)
        })
    }

    fn get_workstep(&self, id: Uuid) -> StoreResult<Workstep> {
        self.with_data(|data| {
            data.worksteps.get(id).cloned().ok_or(StoreError::NotFound {
                entity: "Arbeitsschritt",
                id,
            })
        })
    }

    fn save_workstep(&self, workstep: &Workstep) -> StoreResult<()> {
        self.with_data(|data| {
            if !data.categories.contains(workstep.category.id) {
                return Err(StoreError::NotFound {
                    entity: "Arbeitsschritt-Kategorie",
                    id: workstep.category.id,
                });
            }
            data.worksteps.upsert(workstep.id, workstep.clone());
            Ok(())
        })
    }

    fn delete_workstep(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            if data.worksteps.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Arbeitsschritt",
                    id,
                })
            }
        })
    }
}

impl HourlyRateRepository for MemoryStore {
    fn list_hourly_rates(&self) -> StoreResult<Vec<HourlyRate>> {
        self.with_data(|data| {
            let mut rates = data
                .hourly_rates
                .values()
                .into_iter()
                .cloned()
                .collect::<Vec<_>>();
            rates.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(rates)
        })
    }

    fn get_hourly_rate(&self, id: Uuid) -> StoreResult<HourlyRate> {
        self.with_data(|data| {
            data.hourly_rates
                .get(id)
                .cloned()
                .ok_or(StoreError::NotFound {
                    entity: "Maschinenstundensatz",
                    id,
                })
        })
    }

    fn save_hourly_rate(&self, rate: &HourlyRate) -> StoreResult<()> {
        self.with_data(|data| {
            data.hourly_rates.upsert(rate.id, rate.clone());
            Ok(())
        })
    }

    fn delete_hourly_rate(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            if data.hourly_rates.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Maschinenstundensatz",
                    id,
                })
            }
        })
    }
}

impl ProfileRepository for MemoryStore {
    fn list_calculation_profiles(&self) -> StoreResult<Vec<CalculationProfile>> {
        self.with_data(|data| {
            let mut profiles = data
                .profiles
                .values()
                .into_iter()
                .cloned()
                .collect::<Vec<_>>();
            profiles.sort_by(|a, b| a.name.cmp(&b.name));
            Ok(profiles)
        })
    }

    fn get_calculation_profile(&self, id: Uuid) -> StoreResult<CalculationProfile> {
        self.with_data(|data| {
            data.profiles.get(id).cloned().ok_or(StoreError::NotFound {
                entity: "Kalkulationsprofil",
                id,
            })
        })
    }

    fn save_calculation_profile(&self, profile: &CalculationProfile) -> StoreResult<()> {
        self.with_data(|data| {
            data.profiles.upsert(profile.id, profile.clone());
            Ok(())
        })
    }

    fn delete_calculation_profile(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            if data.profiles.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Kalkulationsprofil",
                    id,
                })
            }
        })
    }
}

impl CalculationRepository for MemoryStore {
    fn list_calculations(&self) -> StoreResult<Vec<CalculationSummary>> {
        self.with_data(|data| {
            let mut summaries = data
                .calculations
                .values()
                .iter()
                .map(|stored| CalculationSummary {
                    id: stored.id.clone(),
                    project_name: stored.project_name.clone(),
                    created_at: stored.created_at.clone(),
                    updated_at: stored.updated_at.clone(),
                    file_count: stored.document.files.len() as u32,
                    total_quantity: stored.document.files.iter().map(|file| file.quantity).sum(),
                })
                .collect::<Vec<_>>();
            // Neueste zuerst — bei gleichem Zeitstempel nach ID, damit die
            // Reihenfolge deterministisch ist.
            summaries.sort_by(|a, b| {
                b.updated_at
                    .cmp(&a.updated_at)
                    .then_with(|| a.id.cmp(&b.id))
            });
            Ok(summaries)
        })
    }

    fn get_calculation(&self, id: Uuid) -> StoreResult<StoredCalculation> {
        self.with_data(|data| {
            data.calculations
                .get(id)
                .cloned()
                .ok_or(StoreError::NotFound {
                    entity: "Kalkulation",
                    id,
                })
        })
    }

    fn save_calculation(&self, calculation: &CalculationInput) -> StoreResult<()> {
        self.with_data(|data| {
            let timestamps = data.calculations.upsert(
                calculation.id,
                StoredCalculation {
                    id: calculation.id.to_string(),
                    project_name: calculation.project_name.clone(),
                    created_at: String::new(),
                    updated_at: String::new(),
                    document: calculation.clone(),
                },
            );
            // Die Zeitstempel stehen auch im gespeicherten Datensatz, damit
            // sie ohne Zugriff auf die interne Tabelle lesbar sind.
            if let Some(stored) = data.calculations.items.get_mut(&calculation.id) {
                stored.created_at = timestamps.created_at;
                stored.updated_at = timestamps.updated_at;
            }
            Ok(())
        })
    }

    fn delete_calculation(&self, id: Uuid) -> StoreResult<()> {
        self.with_data(|data| {
            if data.calculations.remove(id) {
                Ok(())
            } else {
                Err(StoreError::NotFound {
                    entity: "Kalkulation",
                    id,
                })
            }
        })
    }
}
