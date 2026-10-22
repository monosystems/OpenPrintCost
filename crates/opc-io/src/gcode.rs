//! GCode-Parser.
//!
//! Der Parser arbeitet in **zwei Stufen** (Spec 0001, Abschnitt 5):
//!
//! 1. **Slicer-Kommentare.** Viele Slicer schreiben Druckzeit und
//!    Filamentverbrauch als Kommentar in die Datei. Diese Werte sind exakt
//!    (der Slicer hat sie geplant) und gewinnen immer.
//! 2. **Geometrische Simulation.** Ohne verwertbare Kommentare werden die
//!    Fahrbewegungen (`G0`/`G1`: Distanz/Geschwindigkeit, `E`-Extrusion)
//!    simuliert. Das Ergebnis ist eine Näherung und wird als solche
//!    gekennzeichnet (`used_comments == false`).
//!
//! Die Kommentarformate richten sich an der Apache-2.0-Referenzbibliothek
//! `GcodeParserSharp` aus (Audit 2026-10-22):
//!
//! | Slicer | Zeit | Filament |
//! |---|---|---|
//! | PrusaSlicer/SuperSlicer/OrcaSlicer/BambuStudio | `; estimated printing time (normal mode) = 1h 12m 44s`, `; model printing time: …; total estimated time: …` | `; filament used [mm] = …`, `; filament used [cm3] = …` |
//! | Cura | `;TIME:19863` (Sekunden) | `;Filament used: 25.3127m` (Einheit m/cm/mm/km) |
//! | Simplify3D | `; Build time: 7 hours 39 minutes` | `; Filament length: … mm …` |
//! | IdeaMaker | `;Print Time: 15177` (Sekunden) | `;Material#1 Used: 8940.1` (mm) |
//! | CraftWare | `; Time: …` (Minuten) | `; E0len: …` (Meter → mm) |
//!
//! Die Erkennung des Slicers erfolgt über Schlüsselwörter in den ersten 30
//! Kommentarzeilen. Die Simulation versteht `G0`/`G1`, `G90`/`G91`,
//! `M82`/`M83`, `G92` und Werkzeugwechsel (`Tn`); unbekannte Befehle werden
//! ignoriert, nicht abgebrochen.

use crate::error::{IoError, IoResult};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Standard-Filamentdurchmesser in mm, wenn kein Kommentar ihn nennt.
///
/// Entspricht der Referenz (`FilamentDiameter = 1.75` als Vorgabe).
pub const DEFAULT_FILAMENT_DIAMETER_MM: f64 = 1.75;

/// Standard-Vorschub in mm/min, wenn kein `F`-Wort gesetzt wurde.
///
/// Entspricht der Referenz (`lastSpeed = 4000`).
pub const DEFAULT_FEEDRATE_MM_MIN: f64 = 4000.0;

/// Filamentverbrauch eines Extruders.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FilamentUsage {
    /// Verbrauchte Filamentlänge in mm.
    pub length_mm: Decimal,
    /// Filamentdurchmesser in mm, mit dem das Volumen berechnet wurde.
    pub diameter_mm: Decimal,
    /// Verbrauchtes Volumen in mm³.
    pub volume_mm3: Decimal,
}

/// Ergebnis einer GCode-Analyse.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GcodeInfo {
    /// Druckzeit aus Slicer-Kommentaren in Stunden — falls vorhanden.
    pub time_from_comments_hours: Option<Decimal>,
    /// Druckzeit aus der geometrischen Simulation in Stunden.
    ///
    /// Dient als Näherung, wenn keine Kommentarzeit vorliegt — und als
    /// Plausibilitätsanker, wenn eine vorliegt.
    pub simulated_time_hours: Decimal,
    /// Ob die Kommentarzeit verwendet werden sollte.
    pub used_comments: bool,
    /// Filamentverbrauch je Extruder.
    pub filaments: Vec<FilamentUsage>,
    /// Anzahl der Schichten — aus Kommentaren oder Z-Bewegungen.
    pub layer_count: Option<u64>,
    /// Erkannter Slicer, z. B. `"PrusaSlicer"`, `"Cura"`, `"OrcaSlicer"`.
    pub detected_slicer: Option<String>,
}

/// Parst eine GCode-Datei aus ihrem Text.
///
/// Leere Eingaben liefern `Err(IoError::Empty)`. Alles andere liefert eine
/// Auskunft — notfalls eine rein simulierte (`used_comments == false`).
pub fn parse_gcode(text: &str) -> IoResult<GcodeInfo> {
    if text.trim().is_empty() {
        return Err(IoError::Empty);
    }

    let comments: Vec<&str> = text
        .lines()
        .map(str::trim)
        .filter(|line| line.starts_with(';'))
        .collect();

    let detected_slicer = detect_slicer(&comments);
    let time_hours = extract_time(&comments);
    let comment_layers = extract_layer_count(&comments);

    // Die Simulation läuft immer — als Näherung und als Plausibilitätsanker.
    let simulated = simulate(text);

    // Filamentdurchmesser aus Kommentaren übernehmen, sonst Standard.
    let diameters = extract_diameters(&comments);
    let diameter_of = |tool: usize| {
        diameters
            .get(tool)
            .copied()
            .unwrap_or(DEFAULT_FILAMENT_DIAMETER_MM)
    };

    // Kommentarwerte gewinnen; sonst die simulierten Längen.
    let filaments = if let Some(comment) = extract_filament(&comments) {
        comment
            .lengths_mm
            .into_iter()
            .enumerate()
            .map(|(tool, length)| filament_usage(length, diameter_of(tool)))
            .collect()
    } else {
        simulated
            .filament_length_mm_per_tool
            .iter()
            .enumerate()
            .map(|(tool, length)| filament_usage(*length, diameter_of(tool)))
            .collect()
    };

    let used_comments = time_hours.is_some();
    Ok(GcodeInfo {
        time_from_comments_hours: time_hours,
        simulated_time_hours: simulated.time_seconds / Decimal::from(3600),
        used_comments,
        filaments,
        layer_count: comment_layers.or(simulated.layer_count),
        detected_slicer,
    })
}

/// Erkennt den Slicer über Schlüsselwörter in den ersten 30 Kommentarzeilen.
///
/// Die Schlüssel und die Reihenfolge folgen der Referenz
/// (`GetSlicerNameFromLines`); die erste Übereinstimmung gewinnt.
fn detect_slicer(comments: &[&str]) -> Option<String> {
    // (Schlüsselwort, Anzeigename). SuperSlicer schreibt einen eigenen
    // Kopf und gehört zur Prusa-Familie.
    const KEYWORDS: &[(&str, &str)] = &[
        ("BambuStudio", "BambuStudio"),
        ("OrcaSlicer", "OrcaSlicer"),
        ("SuperSlicer", "SuperSlicer"),
        ("PrusaSlicer", "PrusaSlicer"),
        ("Slic3r", "Slic3r"),
        ("KISSlicer", "KISSlicer"),
        ("skeinforge", "Skeinforge"),
        ("Cura_SteamEngine", "Cura"),
        ("CURA_PROFILE_STRING", "Cura"),
        ("Cura", "Cura"),
        ("Miracle", "Makerbot"),
        ("ffslicer", "FlashForge"),
        ("Simplify3D", "Simplify3D"),
        ("Snapmaker", "Snapmaker"),
        ("ideaMaker", "IdeaMaker"),
        ("Voxelizer 2", "Voxelizer2"),
        ("CraftWare", "CraftWare"),
    ];
    comments
        .iter()
        .take(30)
        .filter_map(|line| {
            KEYWORDS
                .iter()
                .find(|(keyword, _)| line.contains(keyword))
                .map(|(_, name)| (*name).to_string())
        })
        .next()
}

/// Extrahiert die Druckzeit aus Slicer-Kommentaren (in Stunden).
///
/// Vorrang: `total estimated time` vor `model printing time` vor
/// `estimated printing time (normal mode)` — wie in der Referenz, wo die
/// letzte Kommentarhälfte gewinnt.
fn extract_time(comments: &[&str]) -> Option<Decimal> {
    // 1) OrcaSlicer/BambuStudio: "; model printing time: 8m 6s; total estimated time: 15m 26s".
    if let Some(hours) = comments.iter().find_map(|line| {
        line.split("total estimated time:")
            .nth(1)
            .and_then(parse_duration_hours)
    }) {
        return Some(hours);
    }
    if let Some(hours) = comments.iter().find_map(|line| {
        line.split("model printing time:")
            .nth(1)
            .map(|value| value.split(';').next().unwrap_or(value))
            .and_then(parse_duration_hours)
    }) {
        return Some(hours);
    }

    // 2) PrusaSlicer & Co.: "; estimated printing time (normal mode) = 1h 12m 44s".
    for mode in ["normal mode", "silent mode"] {
        let marker = format!("estimated printing time ({mode})");
        if let Some(hours) = comments.iter().find_map(|line| {
            line.split(marker.as_str())
                .nth(1)
                .map(|value| value.trim_start_matches(['=', ' ', '\t']))
                .and_then(parse_duration_hours)
        }) {
            return Some(hours);
        }
    }

    // 3) Cura: ";TIME:19863" — Sekunden.
    if let Some(hours) = comments.iter().find_map(|line| {
        line.strip_prefix(";TIME:")
            .and_then(|value| value.trim().parse::<Decimal>().ok())
            .map(|seconds| seconds / Decimal::from(3600))
    }) {
        return Some(hours);
    }

    // 4) Simplify3D: "; Build time: 7 hours 39 minutes".
    if let Some(hours) = comments.iter().find_map(|line| {
        line.trim_start_matches([';', ' ', '\t'])
            .strip_prefix("Build time:")
            .and_then(parse_duration_hours)
    }) {
        return Some(hours);
    }

    // 5) IdeaMaker: ";Print Time: 15177" — Sekunden.
    if let Some(hours) = comments.iter().find_map(|line| {
        line.strip_prefix(";Print Time:")
            .and_then(|value| value.trim().parse::<Decimal>().ok())
            .map(|seconds| seconds / Decimal::from(3600))
    }) {
        return Some(hours);
    }

    // 6) CraftWare: "; Time: …" — Minuten.
    comments.iter().find_map(|line| {
        line.trim_start_matches([';', ' ', '\t'])
            .strip_prefix("Time:")
            .and_then(|value| value.trim().parse::<Decimal>().ok())
            .map(|minutes| minutes / Decimal::from(60))
    })
}

/// Wandelt eine Dauerangabe in Stunden um.
///
/// Verstanden werden `1h 12m 44s`, `8m 6s`, `45s`, `7 hours 39 minutes` und
/// reine Dezimalzahlen (Stunden). Gibt `None` zurück, wenn nichts passt.
///
/// Gerechnet wird in `Decimal`, damit `1h 12m 44s` exakt dasselbe ergibt wie
/// von Hand gerechnet (`1 + 12/60 + 44/3600`).
fn parse_duration_hours(text: &str) -> Option<Decimal> {
    let text = text.trim();
    if text.is_empty() {
        return None;
    }
    // Reine Dezimalzahl → Stunden.
    if let Ok(hours) = text.parse::<Decimal>() {
        return Some(hours);
    }

    let normalized = text
        .replace("hours", "h")
        .replace("hour", "h")
        .replace("minutes", "m")
        .replace("minute", "m")
        .replace("seconds", "s")
        .replace("second", "s")
        .replace(',', " ");

    let mut hours = Decimal::ZERO;
    let mut matched = false;
    let mut number = String::new();
    for character in normalized.chars().chain(std::iter::once(' ')) {
        if character.is_ascii_digit() || character == '.' {
            number.push(character);
        } else if matches!(character, 'h' | 'm' | 's' | ' ') {
            if !number.is_empty() {
                let value: Decimal = number.parse().ok()?;
                match character {
                    'h' => {
                        hours += value;
                        matched = true;
                    }
                    'm' => {
                        hours += value / Decimal::from(60);
                        matched = true;
                    }
                    's' => {
                        hours += value / Decimal::from(3600);
                        matched = true;
                    }
                    _ => return None,
                }
                number.clear();
            } else if !character.is_whitespace() {
                return None;
            }
        } else if !character.is_whitespace() {
            return None;
        }
    }
    if !number.is_empty() || !matched {
        return None;
    }
    Some(hours)
}

/// Extrahiert den Filamentverbrauch aus Slicer-Kommentaren.
///
/// Reihenfolge wie in der Referenz: Prusa-/Orca-`filament used`-Zeilen,
/// Cura-`Filament used`, Simplify3D-`Filament length`, IdeaMaker-`Material#
/// Used`, CraftWare-`E<len>`. Die erste treffende Familie gewinnt.
///
/// Liegen nur Volumen (`[cm3]`) vor, werden die Längen daraus abgeleitet —
/// mit dem Standarddurchmesser, da der Kommentar-Durchmesser erst später
/// zugeordnet wird.
fn extract_filament(comments: &[&str]) -> Option<CommentFilament> {
    // 1) PrusaSlicer & Co.: "; filament used [mm] = 2810.28" (mehrere durch "," oder "|").
    let mut lengths: Vec<f64> = Vec::new();
    let mut volumes_mm3: Vec<f64> = Vec::new();
    for line in comments {
        if let Some(value) = line.split("filament used [mm] =").nth(1) {
            lengths = split_numbers(value);
        } else if let Some(value) = line.split("filament used [cm3] =").nth(1) {
            volumes_mm3 = split_numbers(value).iter().map(|v| v * 1000.0).collect();
        }
    }
    if !lengths.is_empty() {
        return Some(CommentFilament {
            lengths_mm: lengths,
        });
    }
    if !volumes_mm3.is_empty() {
        let area = std::f64::consts::PI * (DEFAULT_FILAMENT_DIAMETER_MM / 2.0).powi(2);
        return Some(CommentFilament {
            lengths_mm: volumes_mm3.iter().map(|v| v / area).collect(),
        });
    }

    // 2) Cura: ";Filament used: 25.3127m" (mehrere durch ",").
    if let Some(parsed) = comments.iter().find_map(|line| {
        line.strip_prefix(";Filament used:").and_then(|value| {
            let parsed: Vec<f64> = value
                .split(',')
                .filter_map(|part| parse_length_with_unit(part.trim()))
                .collect();
            (!parsed.is_empty()).then_some(parsed)
        })
    }) {
        return Some(CommentFilament { lengths_mm: parsed });
    }

    // 3) Simplify3D: "; Filament length: 32256.6 mm (32.26 m)".
    if let Some(length) = comments.iter().find_map(|line| {
        line.trim_start_matches([';', ' ', '\t'])
            .strip_prefix("Filament length:")
            .and_then(|value| value.split_whitespace().next())
            .and_then(|number| number.parse::<f64>().ok())
    }) {
        return Some(CommentFilament {
            lengths_mm: vec![length],
        });
    }

    // 4) IdeaMaker: ";Material#1 Used: 8940.1" (mm).
    let idea_maker: Vec<f64> = comments
        .iter()
        .filter_map(|line| {
            line.strip_prefix(";Material#")
                .and_then(|rest| rest.split("Used:").nth(1))
                .and_then(|value| value.trim().parse::<f64>().ok())
        })
        .collect();
    if !idea_maker.is_empty() {
        return Some(CommentFilament {
            lengths_mm: idea_maker,
        });
    }

    // 5) CraftWare: "; E0len: 1.234" (Meter → mm).
    let craftware: Vec<f64> = comments
        .iter()
        .filter_map(|line| {
            let line = line.trim_start_matches([';', ' ', '\t']);
            let (prefix, value) = line.split_once("len:")?;
            let is_tool = prefix.starts_with('E')
                && !prefix[1..].is_empty()
                && prefix[1..].chars().all(|c| c.is_ascii_digit());
            if is_tool {
                value
                    .trim()
                    .parse::<f64>()
                    .ok()
                    .map(|meters| meters * 1000.0)
            } else {
                None
            }
        })
        .collect();
    if !craftware.is_empty() {
        return Some(CommentFilament {
            lengths_mm: craftware,
        });
    }

    None
}

/// Kommentar-Filament: Längen je Extruder in mm.
struct CommentFilament {
    lengths_mm: Vec<f64>,
}

/// Zerlegt eine durch `,` oder `|` getrennte Zahlenliste.
fn split_numbers(text: &str) -> Vec<f64> {
    text.split([',', '|'])
        .filter_map(|part| part.trim().parse::<f64>().ok())
        .collect()
}

/// Parst eine Längenangabe mit Einheit (`25.3127m`, `12.3cm`, `450mm`).
///
/// Einheiten wie in der Referenz: `m` → ×1000, `cm` → ×10, `mm`/unbekannt →
/// unverändert, `km` → ×1_000_000.
fn parse_length_with_unit(text: &str) -> Option<f64> {
    // Längste Einheit zuerst, damit "mm" nicht als "m" gelesen wird.
    for (suffix, factor) in [
        ("km", 1_000_000.0),
        ("cm", 10.0),
        ("mm", 1.0),
        ("m", 1000.0),
    ] {
        if let Some(number) = text.strip_suffix(suffix) {
            return number
                .trim()
                .parse::<f64>()
                .ok()
                .map(|value| value * factor);
        }
    }
    text.parse::<f64>().ok()
}

/// Extrahiert die Filamentdurchmesser aus Kommentaren (in mm).
///
/// `; filament_diameter = 1.75` (mehrere durch `,`), IdeaMaker
/// `;Filament Diameter #1: 1.75`.
fn extract_diameters(comments: &[&str]) -> Vec<f64> {
    for line in comments {
        if let Some(value) = line.split("filament_diameter =").nth(1) {
            let parsed = split_numbers(value.split(';').next().unwrap_or(value));
            if !parsed.is_empty() {
                return parsed;
            }
        }
    }
    let idea_maker: Vec<f64> = comments
        .iter()
        .filter_map(|line| {
            line.strip_prefix(";Filament Diameter #")
                .and_then(|rest| rest.split(':').nth(1))
                .and_then(|value| value.trim().parse::<f64>().ok())
        })
        .collect();
    if !idea_maker.is_empty() {
        return idea_maker;
    }
    Vec::new()
}

/// Extrahiert die Schichtzahl aus Kommentaren.
///
/// Cura `;LAYER_COUNT:600`, OrcaSlicer `; total layer number: 100`,
/// FlashForge `;layer_count: 50`.
fn extract_layer_count(comments: &[&str]) -> Option<u64> {
    for line in comments {
        if let Some(value) = line.strip_prefix(";LAYER_COUNT:")
            && let Ok(count) = value.trim().parse::<u64>()
        {
            return Some(count);
        }
        let lower = line.to_ascii_lowercase();
        for prefix in ["; total layer number:", ";layer_count:"] {
            if let Some(value) = lower.strip_prefix(prefix)
                && let Ok(count) = value.trim().parse::<u64>()
            {
                return Some(count);
            }
        }
    }
    None
}

/// Baut einen `FilamentUsage` aus Länge (mm) und Durchmesser (mm).
fn filament_usage(length_mm: f64, diameter_mm: f64) -> FilamentUsage {
    let area = std::f64::consts::PI * (diameter_mm / 2.0) * (diameter_mm / 2.0);
    FilamentUsage {
        length_mm: decimal_from_f64(length_mm),
        diameter_mm: decimal_from_f64(diameter_mm),
        volume_mm3: decimal_from_f64(length_mm * area),
    }
}

/// Wandelt ein `f64` exakt in `Decimal` um (über die String-Darstellung).
fn decimal_from_f64(value: f64) -> Decimal {
    value
        .to_string()
        .parse::<Decimal>()
        .unwrap_or(Decimal::ZERO)
}

// ---------------------------------------------------------------------------
// Geometrische Simulation
// ---------------------------------------------------------------------------

/// Ergebnis der geometrischen Simulation.
struct Simulation {
    /// Simulierte Druckzeit in Sekunden.
    time_seconds: Decimal,
    /// Simulierte Filamentlänge je Werkzeug in mm.
    filament_length_mm_per_tool: Vec<f64>,
    /// Schichtzahl aus Z-Bewegungen — falls bestimmbar.
    layer_count: Option<u64>,
}

/// Zustand eines Werkzeugs (Extruders).
#[derive(Debug, Clone)]
struct ToolState {
    /// Letzte E-Position (absolut) bzw. Referenz (nach `G92`).
    last_e: f64,
    /// Verbrauchte Länge in mm.
    used_mm: f64,
}

/// Simuliert die Fahrbewegungen eines GCodes.
///
/// Modell (bewusst einfacher als das beschleunigungsbasierte Modell der
/// Referenz — dokumentierte Näherung):
///
/// * Zeit = Distanz / Vorschub, mit dem jeweils gültigen `F`-Wort (mm/min).
/// * Extrusion verlängert die Zeit nicht — sie läuft parallel zur Fahrt.
///   Reine Extrusionsfahrten (`E` ohne `X`/`Y`/`Z`) werden mit demselben
///   Vorschub bewertet.
/// * `G90`/`G91` schalten die XYZ-Positionierung absolut/relativ; `M82`/`M83`
///   die Extrusion. `G92` setzt die E-Referenz des aktuellen Werkzeugs.
/// * `Tn` wechselt das Werkzeug; jedes Werkzeug sammelt seinen Verbrauch.
/// * Schichten: jede neue maximale Z-Höhe einer extrusierenden Fahrt zählt.
fn simulate(text: &str) -> Simulation {
    let mut x = 0.0;
    let mut y = 0.0;
    let mut z = 0.0;
    let mut feedrate = decimal_from_f64(DEFAULT_FEEDRATE_MM_MIN);
    let mut xyz_absolute = true;
    let mut e_absolute = true;
    let mut tools = vec![ToolState {
        last_e: 0.0,
        used_mm: 0.0,
    }];
    let mut current_tool = 0usize;
    let mut time_seconds = Decimal::ZERO;
    let mut z_levels: BTreeSet<i64> = BTreeSet::new();

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with(';') {
            continue;
        }
        // Kommentar abtrennen, Befehl normalisieren.
        let code = line.split(';').next().unwrap_or("").trim();
        if code.is_empty() {
            continue;
        }
        let mut parts = code.split_whitespace();
        let Some(command) = parts.next() else {
            continue;
        };
        let command = command.to_ascii_uppercase();

        // Werkzeugwechsel: "T0", "T1", …
        if command.len() > 1
            && command.starts_with('T')
            && command[1..].chars().all(|c| c.is_ascii_digit())
        {
            if let Ok(tool) = command[1..].parse::<usize>() {
                while tools.len() <= tool {
                    tools.push(ToolState {
                        last_e: 0.0,
                        used_mm: 0.0,
                    });
                }
                current_tool = tool;
            }
            continue;
        }

        match command.as_str() {
            "G90" => {
                xyz_absolute = true;
                e_absolute = true;
            }
            "G91" => {
                xyz_absolute = false;
                e_absolute = false;
            }
            "M82" => e_absolute = true,
            "M83" => e_absolute = false,
            "G92" => {
                // Setzt Positionen; ohne Argumente wird die E-Referenz genullt.
                let mut any = false;
                for part in parts {
                    let Some((axis, value)) = split_axis(part) else {
                        continue;
                    };
                    match axis {
                        'X' => {
                            x = value;
                            any = true;
                        }
                        'Y' => {
                            y = value;
                            any = true;
                        }
                        'Z' => {
                            z = value;
                            any = true;
                        }
                        'E' => {
                            tools[current_tool].last_e = value;
                            any = true;
                        }
                        _ => {}
                    }
                }
                if !any {
                    tools[current_tool].last_e = 0.0;
                }
            }
            "G0" | "G1" => {
                let mut target = (x, y, z);
                let mut e_delta = 0.0;
                let mut has_move = false;
                let mut has_extrusion = false;

                for part in parts {
                    // Unlesbare Wörter (z. B. "X" ohne Wert) werden ignoriert,
                    // damit ein einzelner Fehler nicht den Rest vergiftet.
                    let Some((axis, value)) = split_axis(part) else {
                        continue;
                    };
                    match axis {
                        'X' => {
                            target.0 = if xyz_absolute { value } else { x + value };
                            has_move = true;
                        }
                        'Y' => {
                            target.1 = if xyz_absolute { value } else { y + value };
                            has_move = true;
                        }
                        'Z' => {
                            target.2 = if xyz_absolute { value } else { z + value };
                            has_move = true;
                        }
                        'E' => {
                            if e_absolute {
                                e_delta = value - tools[current_tool].last_e;
                                tools[current_tool].last_e = value;
                            } else {
                                e_delta = value;
                                tools[current_tool].last_e += value;
                            }
                            has_extrusion = true;
                        }
                        'F' if value > 0.0 => {
                            feedrate = decimal_from_f64(value);
                        }
                        _ => {}
                    }
                }

                let dx = target.0 - x;
                let dy = target.1 - y;
                let dz = target.2 - z;
                let distance = decimal_from_f64((dx * dx + dy * dy + dz * dz).sqrt());
                if has_move {
                    time_seconds += distance / (feedrate / Decimal::from(60));
                } else if has_extrusion {
                    // Reine Extrusionsfahrt: Vorschub wie bei Fahrten.
                    time_seconds +=
                        decimal_from_f64(e_delta.abs()) / (feedrate / Decimal::from(60));
                }
                if e_delta > 0.0 {
                    tools[current_tool].used_mm += e_delta;
                    // Neue maximale Z-Höhe einer extrusierenden Fahrt = neue Schicht.
                    let key = (target.2 * 1000.0).round() as i64;
                    z_levels.insert(key);
                }
                x = target.0;
                y = target.1;
                z = target.2;
            }
            _ => {}
        }
    }

    Simulation {
        time_seconds,
        filament_length_mm_per_tool: tools.iter().map(|tool| tool.used_mm).collect(),
        layer_count: if z_levels.is_empty() {
            None
        } else {
            Some(z_levels.len() as u64)
        },
    }
}

/// Zerlegt ein Wort wie `X12.5` in Achse und Wert.
///
/// Gibt `None` zurück, wenn das Wort keine Zahl trägt — der Aufrufer
/// ignoriert es, statt `NaN` in die Positionsführung zu tragen.
fn split_axis(word: &str) -> Option<(char, f64)> {
    let mut chars = word.chars();
    let axis = chars.next()?.to_ascii_uppercase();
    if !axis.is_ascii_alphabetic() {
        return None;
    }
    let value = chars.as_str().parse::<f64>().ok()?;
    Some((axis, value))
}
