//! Versionierte Migrationen.
//!
//! Migrationen sind **eingebettet** (`include_str!`) und werden in
//! aufsteigender Version genau einmal angewandt. Eine angewandte Migration
//! wird **nie** geändert — Korrekturen kommen als neue Migration dazu
//! (Spec 0001, Abschnitt 8).

use crate::error::{StoreError, StoreResult};
use crate::sqlite::mapping::backend;
use rusqlite::{Connection, params};
use std::path::Path;

/// Eine versionierte Schemaänderung.
pub struct Migration {
    /// Versionsnummer — aufsteigend, lückenlos ab 1.
    pub version: i64,
    /// Name der Migration (zur Nachvollziehbarkeit in `schema_migrations`).
    pub name: &'static str,
    /// Das SQL der Migration.
    pub sql: &'static str,
    /// Ob die Migration Tabellen verwirft/neu aufbaut und daher vorher ein
    /// Datenbank-Backup benötigt.
    pub destructive: bool,
}

/// Alle Migrationen in aufsteigender Versionsfolge.
pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "initial_schema",
        sql: include_str!("migrations/0001_initial_schema.sql"),
        destructive: false,
    },
    Migration {
        version: 2,
        name: "company_info",
        sql: include_str!("migrations/0002_company_info.sql"),
        destructive: false,
    },
    Migration {
        version: 3,
        name: "printer_build_dimensions",
        sql: include_str!("migrations/0003_printer_build_dimensions.sql"),
        destructive: false,
    },
    Migration {
        version: 4,
        name: "company_currency",
        sql: include_str!("migrations/0004_company_currency.sql"),
        destructive: false,
    },
    Migration {
        version: 5,
        name: "calculation_files_composite_key",
        sql: include_str!("migrations/0005_calculation_files_composite_key.sql"),
        destructive: true,
    },
];

/// Die höchste von dieser Version unterstützte Schema-Version.
pub fn latest_version() -> i64 {
    MIGRATIONS
        .iter()
        .map(|migration| migration.version)
        .max()
        .unwrap_or(0)
}

/// Wendet alle noch nicht angewandten Migrationen an.
///
/// Bricht ab, wenn die Datenbank aus einer **neueren** Anwendung stammt
/// (Schema-Version größer als die höchste hier unterstützte) — statt
/// stillschweigend weiterzulaufen und Daten zu verlieren.
pub fn apply_migrations(conn: &mut Connection, path: &Path) -> StoreResult<()> {
    create_migration_table(conn)?;

    let applied = applied_versions(conn)?;
    let latest_applied = applied.iter().copied().max().unwrap_or(0);

    if latest_applied > latest_version() {
        return Err(StoreError::SchemaTooNew {
            found: latest_applied,
            supported: latest_version(),
        });
    }

    if let Some(migration) = MIGRATIONS
        .iter()
        .find(|migration| migration.destructive && migration.version > latest_applied)
    {
        backup_before_destructive_migration(conn, path, migration.version)?;
    }

    for migration in MIGRATIONS {
        if migration.version <= latest_applied {
            continue;
        }
        apply_one(conn, migration)?;
    }

    Ok(())
}

/// Legt vor einer destruktiven Migration eine konsistente Kopie der Datenbank an.
///
/// `VACUUM INTO` schreibt auch bei aktivem WAL einen konsistenten Snapshot und
/// lässt die laufende Verbindung unangetastet.
fn backup_before_destructive_migration(
    conn: &Connection,
    path: &Path,
    target_version: i64,
) -> StoreResult<()> {
    if path == Path::new(":memory:") {
        return Ok(());
    }
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("openprintcost.db");
    let timestamp = chrono::Utc::now().timestamp_millis();
    let backup = path.with_file_name(format!("{file_name}.backup-v{target_version}-{timestamp}"));
    let backup_text = backup.to_string_lossy().into_owned();
    conn.execute("VACUUM INTO ?1", params![backup_text])
        .map_err(|error| StoreError::Migration {
            version: target_version,
            message: format!(
                "Backup vor Migration {} konnte nicht angelegt werden: {error}",
                target_version
            ),
        })?;
    super::set_private_permissions(&backup)?;
    Ok(())
}

/// Legt die Protokolltabelle an, falls sie noch fehlt.
fn create_migration_table(conn: &mut Connection) -> StoreResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
             version    INTEGER PRIMARY KEY NOT NULL,
             name       TEXT NOT NULL,
             applied_at TEXT NOT NULL
         );",
    )
    .map_err(|error| StoreError::Backend {
        message: format!("schema_migrations konnte nicht angelegt werden: {error}"),
    })
}

/// Liest alle angewandten Versionen.
fn applied_versions(conn: &Connection) -> StoreResult<Vec<i64>> {
    let mut statement = conn
        .prepare("SELECT version FROM schema_migrations")
        .map_err(backend)?;
    let rows = statement
        .query_map([], |row| row.get::<_, i64>(0))
        .map_err(backend)?;

    let mut versions = Vec::new();
    for row in rows {
        versions.push(row.map_err(backend)?);
    }
    Ok(versions)
}

/// Wendet eine einzelne Migration in einer Transaktion an.
fn apply_one(conn: &mut Connection, migration: &Migration) -> StoreResult<()> {
    let transaction = conn.transaction().map_err(|error| StoreError::Migration {
        version: migration.version,
        message: format!("Transaktion konnte nicht begonnen werden: {error}"),
    })?;

    transaction
        .execute_batch(migration.sql)
        .map_err(|error| StoreError::Migration {
            version: migration.version,
            message: format!("Migration '{}' fehlgeschlagen: {error}", migration.name),
        })?;

    transaction
        .execute(
            "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
            rusqlite::params![
                migration.version,
                migration.name,
                crate::sqlite::mapping::now_iso8601()
            ],
        )
        .map_err(|error| StoreError::Migration {
            version: migration.version,
            message: format!("Version konnte nicht protokolliert werden: {error}"),
        })?;

    transaction
        .commit()
        .map_err(|error| StoreError::Migration {
            version: migration.version,
            message: format!("Transaktion konnte nicht abgeschlossen werden: {error}"),
        })?;

    Ok(())
}
