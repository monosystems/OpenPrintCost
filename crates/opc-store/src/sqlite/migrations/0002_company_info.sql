-- Migration 2: Firmendaten als Singleton-Zeile.
--
-- Genau eine Zeile (id = 1). Fehlt sie, liefert der Adapter leere
-- Firmendaten — Einstellungen sind immer lesbar, nie ein Fehler.

CREATE TABLE IF NOT EXISTS company_info (
    id       INTEGER PRIMARY KEY CHECK (id = 1),
    name     TEXT NOT NULL DEFAULT '',
    street   TEXT NOT NULL DEFAULT '',
    zip_city TEXT NOT NULL DEFAULT '',
    email    TEXT NOT NULL DEFAULT ''
);
