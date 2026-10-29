-- Migration 4: Währung als reines Anzeige-Symbol.
--
-- Alle Beträge bleiben in genau einer Währung (keine Umrechnung).
-- Bestehende Datenbanken erhalten "EUR" als Standard.

ALTER TABLE company_info ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR';
