-- Migration 3: Maximale Druckgröße statt nur Bauvolumen.
--
-- Nutzer kennen die maximalen Achsenmaße ihres Druckers, nicht das
-- Bauvolumen in mm³. Die drei Achsenmaße werden deshalb separat gespeichert;
-- das Bauvolumen wird daraus berechnet.
--
-- Die Spalte `build_volume_mm3` bleibt aus Kompatibilitätsgründen erhalten
-- und wird beim Speichern als abgeleiteter Wert mitgeschrieben. Bestehende
-- Zeilen behalten ihr bisheriges Volumen, bis der Drucker erneut gespeichert
-- wird; die Achsenmaße starten bei 0.

ALTER TABLE printers ADD COLUMN build_width_mm TEXT NOT NULL DEFAULT '0';
ALTER TABLE printers ADD COLUMN build_depth_mm TEXT NOT NULL DEFAULT '0';
ALTER TABLE printers ADD COLUMN build_height_mm TEXT NOT NULL DEFAULT '0';
