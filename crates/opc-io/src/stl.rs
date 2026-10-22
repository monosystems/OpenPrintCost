//! Volumenberechnung aus STL-Meshes.
//!
//! Das Volumen wird über die **Tetraeder-Summation** bestimmt: Jedes Dreieck
//! bildet mit dem Ursprung ein Tetraeder; die Summe der signierten Volumina
//! ergibt das Volumen des geschlossenen Körpers (Spec 0001, Abschnitt 5).
//!
//! Unterstützt werden **binäre** und **ASCII**-STL-Dateien. Die Einheit der
//! Datei wird als **Millimeter** angenommen (Slicer-Konvention); das Ergebnis
//! wird in **cm³** geliefert.

use crate::error::{IoError, IoResult};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Ein Dreieck als drei Eckpunkte in Millimetern.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Triangle {
    /// Erster Eckpunkt (x, y, z) in mm.
    pub a: [f64; 3],
    /// Zweiter Eckpunkt (x, y, z) in mm.
    pub b: [f64; 3],
    /// Dritter Eckpunkt (x, y, z) in mm.
    pub c: [f64; 3],
}

impl Triangle {
    /// Signiertes Tetraeder-Volumen des Dreiecks mit dem Ursprung in mm³.
    ///
    /// ```text
    /// V = (a · (b × c)) / 6
    /// ```
    ///
    /// Das Vorzeichen hängt von der Orientierung ab; die Summe über einen
    /// geschlossenen Körper ist das exakte Volumen.
    pub fn signed_volume_mm3(self) -> f64 {
        let [ax, ay, az] = self.a;
        let [bx, by, bz] = self.b;
        let [cx, cy, cz] = self.c;
        (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6.0
    }
}

/// Ergebnis einer STL-Analyse.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StlInfo {
    /// Volumen in cm³ (Betrag der Tetraeder-Summe).
    pub volume_cm3: Decimal,
    /// Anzahl der Dreiecke.
    pub triangle_count: u64,
    /// Begrenzungsrahmen in mm: ((min_x, min_y, min_z), (max_x, max_y, max_z)).
    pub bounding_box_mm: Option<([f64; 3], [f64; 3])>,
}

/// Parst eine STL-Datei aus einem Byte-Slice und berechnet das Volumen.
///
/// Das Format wird automatisch erkannt: beginnt der Inhalt nach führenden
/// Leerzeichen mit `solid` **und** enthält er das Wort `facet`, wird ASCII
/// angenommen — sonst binär. (Ein binäres STL kann zufällig mit `solid`
/// beginnen; der zusätzliche `facet`-Test schließt das aus.)
pub fn parse_stl(bytes: &[u8]) -> IoResult<StlInfo> {
    if bytes.is_empty() {
        return Err(IoError::Empty);
    }
    let triangles = detect_and_parse(bytes)?;
    Ok(analyze(&triangles))
}

/// Erkennt das Format und parst die Dreiecke.
fn detect_and_parse(bytes: &[u8]) -> IoResult<Vec<Triangle>> {
    let head = bytes
        .iter()
        .take(512)
        .map(|byte| byte.to_ascii_lowercase())
        .collect::<Vec<_>>();
    let head_text = String::from_utf8_lossy(&head);
    let looks_like_ascii = head_text.trim_start().starts_with("solid")
        && head_text.contains("facet")
        && std::str::from_utf8(bytes).is_ok();

    if looks_like_ascii {
        let text = std::str::from_utf8(bytes).map_err(|_| IoError::Corrupt {
            message: "ASCII-STL enthält ungültiges UTF-8".to_string(),
        })?;
        parse_ascii(text)
    } else {
        parse_binary(bytes)
    }
}

/// Parst ein binäres STL.
///
/// Aufbau: 80 Byte Kopf, `u32` Dreieckszahl, je Dreieck 12 × `f32`
/// (Normale + 3 Eckpunkte) und 2 Byte Attribut.
fn parse_binary(bytes: &[u8]) -> IoResult<Vec<Triangle>> {
    if bytes.len() < 84 {
        return Err(IoError::Corrupt {
            message: format!("Binär-STL ist zu kurz ({} Byte)", bytes.len()),
        });
    }
    let count = u32::from_le_bytes(bytes[80..84].try_into().map_err(|_| IoError::Corrupt {
        message: "Binär-STL-Kopf ist unlesbar".to_string(),
    })?) as usize;
    let expected = 84 + count * 50;
    if bytes.len() < expected {
        return Err(IoError::Corrupt {
            message: format!(
                "Binär-STL meldet {count} Dreiecke, enthält aber nur {} von {expected} Byte",
                bytes.len()
            ),
        });
    }

    let mut triangles = Vec::with_capacity(count.min(1_000_000));
    let mut offset = 84;
    for triangle_index in 0..count {
        let mut floats = [0f32; 12];
        for (index, chunk) in bytes[offset..offset + 48].chunks(4).enumerate() {
            floats[index] = f32::from_le_bytes(chunk.try_into().map_err(|_| IoError::Corrupt {
                message: format!("Binär-STL: Dreieck {triangle_index} ist abgeschnitten"),
            })?);
        }
        triangles.push(Triangle {
            a: [
                f64::from(floats[3]),
                f64::from(floats[4]),
                f64::from(floats[5]),
            ],
            b: [
                f64::from(floats[6]),
                f64::from(floats[7]),
                f64::from(floats[8]),
            ],
            c: [
                f64::from(floats[9]),
                f64::from(floats[10]),
                f64::from(floats[11]),
            ],
        });
        offset += 50;
    }
    Ok(triangles)
}

/// Parst ein ASCII-STL.
///
/// Erwartet `facet normal …` / `outer loop` / drei `vertex`-Zeilen /
/// `endloop` / `endfacet`. Die Normale wird ignoriert — sie trägt nichts zum
/// Volumen bei.
fn parse_ascii(text: &str) -> IoResult<Vec<Triangle>> {
    let mut triangles = Vec::new();
    let mut current: Vec<[f64; 3]> = Vec::with_capacity(3);

    for (line_number, line) in text.lines().enumerate() {
        let line = line.trim();
        let Some(vertex) = line.strip_prefix("vertex") else {
            continue;
        };
        let mut parts = vertex.split_whitespace();
        let x = parse_coordinate(parts.next(), line_number)?;
        let y = parse_coordinate(parts.next(), line_number)?;
        let z = parse_coordinate(parts.next(), line_number)?;
        current.push([x, y, z]);

        if current.len() == 3 {
            let [a, b, c] = [current[0], current[1], current[2]];
            triangles.push(Triangle { a, b, c });
            current.clear();
        }
    }

    if !current.is_empty() {
        return Err(IoError::Corrupt {
            message: "ASCII-STL endet mit einem unvollständigen Dreieck".to_string(),
        });
    }
    if triangles.is_empty() {
        return Err(IoError::Corrupt {
            message: "ASCII-STL enthält keine Dreiecke".to_string(),
        });
    }
    Ok(triangles)
}

/// Parst eine Koordinate einer `vertex`-Zeile.
fn parse_coordinate(value: Option<&str>, line_number: usize) -> IoResult<f64> {
    value
        .ok_or_else(|| IoError::Corrupt {
            message: format!("Zeile {}: unvollständiger Eckpunkt", line_number + 1),
        })?
        .parse::<f64>()
        .map_err(|_| IoError::Corrupt {
            message: format!("Zeile {}: keine gültige Zahl", line_number + 1),
        })
}

/// Summiert die Tetraeder-Volumina und baut das Ergebnis auf.
///
/// Das Ergebnis wird in cm³ geliefert (mm³ / 1000). Die Umwandlung nach
/// `Decimal` erfolgt über die String-Darstellung — exakt und ohne
/// `f64`-Rundungsfehler an der Grenze.
pub fn analyze(triangles: &[Triangle]) -> StlInfo {
    let volume_mm3: f64 = triangles
        .iter()
        .map(|triangle| triangle.signed_volume_mm3())
        .sum();
    // Auf 10⁻⁶ mm³ runden: Drittel-Volumina (z. B. 2666,666… mm³) sind binär
    // nicht exakt darstellbar. Die Rundung liegt weit unter jeder
    // Druckerauflösung und verhindert Reste wie 7,999999999999999 cm³.
    let volume_mm3 = (volume_mm3 * 1_000_000.0).round() / 1_000_000.0;
    let volume_cm3 = decimal_from_f64(volume_mm3.abs() / 1000.0);

    let mut min = [f64::INFINITY; 3];
    let mut max = [f64::NEG_INFINITY; 3];
    for triangle in triangles {
        for point in [triangle.a, triangle.b, triangle.c] {
            for axis in 0..3 {
                min[axis] = min[axis].min(point[axis]);
                max[axis] = max[axis].max(point[axis]);
            }
        }
    }
    let bounding_box_mm = if triangles.is_empty() {
        None
    } else {
        Some((min, max))
    };

    StlInfo {
        volume_cm3,
        triangle_count: triangles.len() as u64,
        bounding_box_mm,
    }
}

/// Wandelt ein `f64` exakt in `Decimal` um.
///
/// Über die kürzeste String-Darstellung (`{}`), damit kein binärer
/// Rundungsfehler in die Dezimalzahl wandert.
fn decimal_from_f64(value: f64) -> Decimal {
    value
        .to_string()
        .parse::<Decimal>()
        .unwrap_or(Decimal::ZERO)
}
