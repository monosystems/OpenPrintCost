//! Fehler des Speicherports.

use uuid::Uuid;

/// Fehler, die der Speicherport melden kann.
///
/// Der Port kennt **keine** SQL-Fehler: Datenbankfehler werden in
/// [`StoreError::Backend`] zusammengefasst, damit die Oberfläche nicht an
/// ein bestimmtes Speicherbackend gebunden ist.
#[derive(Debug, Clone, thiserror::Error)]
pub enum StoreError {
    /// Ein angeforderter Datensatz existiert nicht.
    #[error("{entity} mit ID {id} wurde nicht gefunden")]
    NotFound {
        /// Art des Datensatzes, z. B. „Drucker“.
        entity: &'static str,
        /// ID des nicht gefundenen Datensatzes.
        id: Uuid,
    },
    /// Die Datenbank oder das Backend hat einen Fehler gemeldet.
    #[error("Speicherfehler: {message}")]
    Backend {
        /// Fehlerbeschreibung des Backends.
        message: String,
    },
    /// Eine Migration ist fehlgeschlagen.
    #[error("Migration fehlgeschlagen (Version {version}): {message}")]
    Migration {
        /// Versionsnummer der Migration.
        version: i64,
        /// Fehlerbeschreibung.
        message: String,
    },
    /// Die Datenbank stammt aus einer neueren Version der Anwendung.
    #[error(
        "Die Datenbank wurde mit einer neueren Version erstellt (Schema {found}, erwartet höchstens {supported})"
    )]
    SchemaTooNew {
        /// In der Datenbank gefundene Schema-Version.
        found: i64,
        /// Höchste von dieser Version unterstützte Schema-Version.
        supported: i64,
    },
    /// Ein Wert liegt außerhalb des darstellbaren Bereichs.
    #[error("Ungültiger Wert: {message}")]
    InvalidValue {
        /// Fehlerbeschreibung.
        message: String,
    },
    /// Eine ID wurde nicht als UUID übergeben.
    #[error("Ungültige ID '{value}'")]
    InvalidId {
        /// Der ungültige Wert.
        value: String,
    },
    /// Ein Datensatz wird noch von anderen Datensätzen referenziert.
    #[error("{entity} mit ID {id} wird noch referenziert und kann nicht gelöscht werden")]
    InUse {
        /// Art des Datensatzes, z. B. „Arbeitsschritt-Kategorie“.
        entity: &'static str,
        /// ID des Datensatzes.
        id: Uuid,
    },
    /// Gespeicherte Daten konnten nicht gelesen werden (z. B. beschädigtes JSON).
    #[error("Gespeicherte Daten sind unlesbar: {message}")]
    Corrupt {
        /// Fehlerbeschreibung.
        message: String,
    },
    /// Eine Kalkulationsdatei ist strukturell ungültig.
    #[error("Kalkulationsdatei ist ungültig: {message}")]
    InvalidDocument {
        /// Fehlerbeschreibung.
        message: String,
    },
    /// Eine Kalkulationsdatei gehört zu einem anderen Dateiformat.
    #[error("Unbekanntes Kalkulationsformat '{found}' (erwartet '{expected}')")]
    UnsupportedDocument {
        /// Gefundenes Format.
        found: String,
        /// Erwartetes Format.
        expected: String,
    },
    /// Eine Kalkulationsdatei wurde mit einer neueren Version geschrieben.
    #[error(
        "Kalkulationsdatei hat Version {found}; unterstützt wird höchstens Version {supported}"
    )]
    UnsupportedDocumentVersion {
        /// Gefundene Version.
        found: u32,
        /// Höchste unterstützte Version.
        supported: u32,
    },
}

impl StoreError {
    /// Kurzmeldung ohne Kontext — für die Fehleranzeige der Oberfläche.
    pub fn message(&self) -> String {
        self.to_string()
    }
}

/// Ergebnis eines Speichervorgangs.
pub type StoreResult<T> = Result<T, StoreError>;
