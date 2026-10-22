-- Migration 1: Ausgangsschema für Stammdaten und Kalkulationen.
--
-- Alle Geldbeträge und Messwerte werden als TEXT gespeichert: SQLite kennt
-- keinen exakten Dezimaltyp. REAL wäre eine Fließkommazahl und würde die in
-- `opc-core` garantierte Exaktheit zerstören.
--
-- IDs sind UUID v4 als TEXT (kanonisch, kleingeschrieben) — kein
-- INTEGER PRIMARY KEY, damit Kalkulationen zwischen Installationen
-- exportierbar bleiben.

CREATE TABLE IF NOT EXISTS printers (
    id                    TEXT PRIMARY KEY NOT NULL,
    model                 TEXT NOT NULL,
    manufacturer          TEXT,
    process               TEXT NOT NULL,
    material_family       TEXT NOT NULL,
    power_watts           TEXT NOT NULL,
    build_volume_mm3      TEXT NOT NULL,
    purchase_price        TEXT NOT NULL,
    hourly_rate           TEXT,
    nozzle_wear_cost      TEXT,
    build_plate_wear_cost TEXT,
    material_change_cost  TEXT,
    properties            TEXT NOT NULL DEFAULT '{}',
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS materials (
    id             TEXT PRIMARY KEY NOT NULL,
    name           TEXT NOT NULL,
    material_type  TEXT NOT NULL,
    family         TEXT NOT NULL,
    manufacturer   TEXT,
    shop_link      TEXT,
    density_g_cm3  TEXT NOT NULL,
    package_size   TEXT NOT NULL,
    unit           TEXT NOT NULL,
    price          TEXT NOT NULL,
    properties     TEXT NOT NULL DEFAULT '{}',
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workstep_categories (
    id    TEXT PRIMARY KEY NOT NULL,
    name  TEXT NOT NULL,
    color TEXT
);

CREATE TABLE IF NOT EXISTS worksteps (
    id               TEXT PRIMARY KEY NOT NULL,
    name             TEXT NOT NULL,
    category_id      TEXT NOT NULL REFERENCES workstep_categories (id),
    calculation_type TEXT NOT NULL,
    price            TEXT NOT NULL,
    quantity         TEXT NOT NULL,
    duration_hours   TEXT NOT NULL,
    timing           TEXT NOT NULL,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hourly_rates (
    id                     TEXT PRIMARY KEY NOT NULL,
    name                   TEXT NOT NULL,
    time_basis             TEXT NOT NULL,
    machine_hours          TEXT NOT NULL,
    replacement_cost       TEXT NOT NULL,
    service_life_years     TEXT NOT NULL,
    interest_rate_percent  TEXT NOT NULL,
    maintenance_fixed      TEXT NOT NULL,
    rent_fixed             TEXT NOT NULL,
    electricity_fixed      TEXT NOT NULL,
    additional_fixed       TEXT NOT NULL,
    maintenance_variable   TEXT NOT NULL,
    electricity_variable   TEXT NOT NULL,
    additional_variable    TEXT NOT NULL,
    fixed_rate_override    TEXT,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calculation_profiles (
    id                                TEXT PRIMARY KEY NOT NULL,
    name                              TEXT NOT NULL,
    fail_rate_percent                 TEXT NOT NULL,
    tax_rate_percent                  TEXT NOT NULL,
    margin_percent                    TEXT NOT NULL,
    handling_fee                      TEXT NOT NULL,
    handling_fee_scope                TEXT NOT NULL,
    energy_price_per_kwh              TEXT NOT NULL,
    apply_energy_costs                INTEGER NOT NULL,
    power_level_percent               TEXT NOT NULL,
    combine_materials                 INTEGER NOT NULL,
    multiply_print_time_with_quantity INTEGER NOT NULL,
    print_time_factor                 TEXT NOT NULL,
    exclude_machine_from_margin       INTEGER NOT NULL,
    exclude_material_from_margin      INTEGER NOT NULL,
    exclude_worksteps_from_margin     INTEGER NOT NULL,
    created_at                        TEXT NOT NULL,
    updated_at                        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calculations (
    id           TEXT PRIMARY KEY NOT NULL,
    project_name TEXT NOT NULL,
    notes        TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    document     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calculation_files (
    id              TEXT PRIMARY KEY NOT NULL,
    calculation_id  TEXT NOT NULL REFERENCES calculations (id) ON DELETE CASCADE,
    file_name       TEXT NOT NULL,
    quantity        INTEGER NOT NULL,
    print_time_hours TEXT NOT NULL,
    volume_cm3      TEXT,
    weight_g        TEXT,
    material_changes INTEGER NOT NULL,
    sort_order      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calculation_files_calculation
    ON calculation_files (calculation_id);

CREATE INDEX IF NOT EXISTS idx_worksteps_category
    ON worksteps (category_id);
