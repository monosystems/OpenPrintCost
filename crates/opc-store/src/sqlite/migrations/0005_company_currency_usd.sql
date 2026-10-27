-- Migration 5: Referenzwährung auf US-Dollar umstellen.
--
-- Beträge sind reine Anzeigewerte ohne Umrechnung. Da die Vorlagen und
-- Exporte auf Dollar-Referenzwerten basieren, übernehmen bestehende
-- Datenbanken den Dollar; eine bewusst gewählte andere Währung kann in
-- den Einstellungen erneut gesetzt werden.

UPDATE company_info SET currency = 'USD' WHERE currency = 'EUR';
