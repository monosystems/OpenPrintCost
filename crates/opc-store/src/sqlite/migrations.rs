//! Versionierte Migrationen.
//!
//! Migrationen sind **eingebettet** (`include_str!`) und werden in
//! aufsteigender Version genau einmal angewandt. Eine angewandte Migration
//! wird **nie** geändert — Korrekturen kommen als neue Migration dazu
//! (Spec 0001, Abschnitt 8).

use crate::error::{StoreError, StoreResult};
use crate::sqlite::mapping::backend;
use rusqlite::Connection;

/// Eine versionierte Schemaänderung.
pub struct Migration {
    /// Versionsnummer — aufsteigend, lückenlos ab 1.
    pub version: i64,
    /// Name der Migration (zur Nachvollziehbarkeit in `schema_migrations`).
    pub name: &'static str,
    /// Das SQL der Migration.
    pub sql: &'static str,
}

/// Alle Migrationen in aufsteigender Versionsfolge.
pub const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "initial_schema",
    sql: include_str!("migrations/0001_initial_schema.sql"),
}];

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
pub fn apply_migrations(conn: &mut Connection) -> StoreResult<()> {
    create_migration_table(conn)?;

    let applied = applied_versions(conn)?;
    let latest_applied = applied.iter().copied().max().unwrap_or(0);

    if latest_applied > latest_version() {
        return Err(StoreError::SchemaTooNew {
            found: latest_applied,
            supported: latest_version(),
        });
    }

    for migration in MIGRATIONS {
        if migration.version <= latest_applied {
            continue;
        }
        apply_one(conn, migration)?;
    }

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
