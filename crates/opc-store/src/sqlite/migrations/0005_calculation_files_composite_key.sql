-- Datei-IDs sind nur innerhalb einer Kalkulation eindeutig. Zwei
-- Kalkulationen dürfen dieselbe Datei-ID (z. B. aus einem kopierten
-- Dokument) verwenden, ohne dass der zweite Speichervorgang scheitert.

CREATE TABLE calculation_files_new (
    id               TEXT NOT NULL,
    calculation_id   TEXT NOT NULL REFERENCES calculations (id) ON DELETE CASCADE,
    file_name        TEXT NOT NULL,
    quantity         INTEGER NOT NULL,
    print_time_hours TEXT NOT NULL,
    volume_cm3       TEXT,
    weight_g         TEXT,
    material_changes INTEGER NOT NULL,
    sort_order       INTEGER NOT NULL,
    PRIMARY KEY (calculation_id, id)
);

INSERT INTO calculation_files_new (
    id, calculation_id, file_name, quantity, print_time_hours,
    volume_cm3, weight_g, material_changes, sort_order
)
SELECT
    id, calculation_id, file_name, quantity, print_time_hours,
    volume_cm3, weight_g, material_changes, sort_order
FROM calculation_files;

DROP TABLE calculation_files;
ALTER TABLE calculation_files_new RENAME TO calculation_files;

CREATE INDEX IF NOT EXISTS idx_calculation_files_calculation
    ON calculation_files (calculation_id);
