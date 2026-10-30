//! 3MF-Projektimport.
//!
//! Eine 3MF-Datei ist ein OPC-Paket (ZIP) mit einem XML-Modell. Gelesen werden
//!
//! * `3D/3dmodel.model` und weitere `*.model`-Dateien (Mesh, Materialien,
//!   Build-Items, verschachtelte Komponenten),
//! * `Metadata/slice_info.config` (Bambu Studio / OrcaSlicer: geschätzte Zeit,
//!   Filamentverbrauch je Extruder),
//! * `Metadata/Slic3r_PE.config` (PrusaSlicer: Zeit- und Filamentkommentare).
//!
//! Das Ergebnis ist ein **Druckauftrag**: alle Build-Items werden zu einem
//! Volumen und einem Begrenzungsrahmen zusammengefasst. Mehrere Platten eines
//! Projekts werden summiert. Die Funktion ist **pure**: Bytes hinein, Struktur
//! heraus — kein Dateisystem, kein Netzwerk, keine Uhr.

use crate::error::{IoError, IoResult};
use crate::gcode;
use quick_xml::XmlVersion;
use quick_xml::events::{BytesStart, Event};
use quick_xml::reader::Reader;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read};
use zip::ZipArchive;

/// Pfad des Hauptmodells im 3MF-Paket (normalisiert, kleingeschrieben).
const MAIN_MODEL: &str = "3d/3dmodel.model";
/// Maximale Anzahl Einträge im ZIP-Paket.
const MAX_ZIP_ENTRIES: usize = 512;
/// Maximale Größe einer Modelldatei (entpackt).
const MAX_MODEL_BYTES: u64 = 256 * 1024 * 1024;
/// Maximale Gesamtgröße aller Modelldateien (entpackt).
const MAX_TOTAL_MODEL_BYTES: u64 = 512 * 1024 * 1024;
/// Maximale Größe einer Metadatendatei (entpackt).
const MAX_METADATA_BYTES: u64 = 8 * 1024 * 1024;
/// Maximale Verschachtelungstiefe von Komponenten.
const MAX_COMPONENT_DEPTH: usize = 64;
/// Standard-Filamentdurchmesser, wenn die Datei keinen nennt.
const DEFAULT_FILAMENT_DIAMETER_MM: f64 = 1.75;
/// Volumen eines Meters 1,75-mm-Filaments in cm³.
const FILAMENT_CM3_PER_METER: f64 = 2.405_281_4;

/// Ergebnis einer 3MF-Analyse.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ThreeMfInfo {
    /// Gesamtvolumen aller druckbaren Objekte in cm³.
    pub volume_cm3: Decimal,
    /// Außenmaße des gesamten Druckauftrags in mm (Breite X, Tiefe Y, Höhe Z).
    pub dimensions_mm: Option<[Decimal; 3]>,
    /// Anzahl der Build-Items (Objektinstanzen auf der Platte).
    pub object_count: u32,
    /// Materialnamen aus dem Modell, dedupliziert in Dateireihenfolge.
    pub material_names: Vec<String>,
    /// Vom Slicer geschätzte Druckzeit in Stunden.
    pub estimated_time_hours: Option<Decimal>,
    /// Filamentvolumen je Extruder in cm³.
    pub filament_volumes_cm3: Vec<Decimal>,
    /// Erkannter Slicer, z. B. `"BambuStudio"` oder `"PrusaSlicer"`.
    pub detected_slicer: Option<String>,
}

/// Eine 3MF-Datei aus einem Byte-Slice parsen.
///
/// Liefert immer dann einen Fehler, wenn das Paket kein lesbares Modell
/// enthält. Fehlende Druckzeit- oder Filamentmetadaten sind **kein** Fehler:
/// Dann bleiben die entsprechenden Felder leer und die Oberfläche fragt sie
/// wie bei einem STL-Import manuell ab.
///
/// Alle Modelldateien werden in der Einheit des Hauptmodells interpretiert;
/// das entspricht der Produktionserweiterung, in der Untermodelle dieselbe
/// Einheit wie das Hauptmodell verwenden.
pub fn parse_3mf(bytes: &[u8]) -> IoResult<ThreeMfInfo> {
    if bytes.is_empty() {
        return Err(IoError::Empty);
    }

    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|error| IoError::Corrupt {
        message: format!("3MF ist kein gültiges ZIP-Archiv: {error}"),
    })?;
    if archive.len() > MAX_ZIP_ENTRIES {
        return Err(IoError::Corrupt {
            message: format!(
                "3MF enthält {} Einträge (maximal {MAX_ZIP_ENTRIES})",
                archive.len()
            ),
        });
    }

    let names = archive
        .file_names()
        .filter_map(|name| name.ok().map(|name| name.into_owned()))
        .collect::<Vec<_>>();
    let model_names = names
        .iter()
        .filter(|name| normalize_path(name).ends_with(".model"))
        .cloned()
        .collect::<Vec<_>>();
    if model_names.is_empty() {
        return Err(IoError::Corrupt {
            message: "3MF enthält keine Modelldatei (3D/3dmodel.model)".to_string(),
        });
    }

    // Bereits die deklarierten Größen begrenzen, damit ein ZIP mit vielen
    // stark komprimierten Modelldateien nicht erst beim Entpacken auffällt.
    let mut declared_model_bytes = 0u64;
    for name in &model_names {
        let file = archive.by_name(name).map_err(|error| IoError::Corrupt {
            message: format!("3MF-Eintrag '{name}' ist unlesbar: {error}"),
        })?;
        declared_model_bytes = declared_model_bytes.saturating_add(file.size());
        if declared_model_bytes > MAX_TOTAL_MODEL_BYTES {
            return Err(IoError::Corrupt {
                message: format!(
                    "3MF-Modelldateien sind zusammen zu groß (maximal {} MB)",
                    MAX_TOTAL_MODEL_BYTES / (1024 * 1024)
                ),
            });
        }
    }

    let mut models = BTreeMap::new();
    let mut read_model_bytes = 0u64;
    for name in &model_names {
        let xml = read_entry(&mut archive, name, MAX_MODEL_BYTES)?;
        read_model_bytes = read_model_bytes.saturating_add(xml.len() as u64);
        if read_model_bytes > MAX_TOTAL_MODEL_BYTES {
            return Err(IoError::Corrupt {
                message: format!(
                    "3MF-Modelldateien sind zusammen zu groß (maximal {} MB)",
                    MAX_TOTAL_MODEL_BYTES / (1024 * 1024)
                ),
            });
        }
        let model = parse_model(&xml)?;
        models.insert(normalize_path(name), model);
    }

    let main_key = if models.contains_key(MAIN_MODEL) {
        MAIN_MODEL.to_string()
    } else {
        models
            .keys()
            .next()
            .cloned()
            .ok_or_else(|| IoError::Corrupt {
                message: "3MF enthält keine lesbare Modelldatei".to_string(),
            })?
    };

    let slice_info = read_named_entry(
        &mut archive,
        &names,
        "metadata/slice_info.config",
        MAX_METADATA_BYTES,
    )?
    .map(|xml| parse_slice_info(&xml));
    let prusa_config = read_named_entry(
        &mut archive,
        &names,
        "metadata/slic3r_pe.config",
        MAX_METADATA_BYTES,
    )?
    .map(|text| parse_prusa_config(&text));

    let (slice_time_seconds, slice_volumes) = slice_info.unwrap_or((None, Vec::new()));
    let has_prusa_config = prusa_config.is_some();
    let (prusa_time_hours, prusa_volumes) = prusa_config.unwrap_or((None, Vec::new()));

    let estimated_time_hours = match slice_time_seconds {
        Some(seconds) if seconds.is_finite() => {
            Some(decimal_from_f64(round_to(seconds / 3600.0, 6)))
        }
        Some(_) => {
            return Err(IoError::Corrupt {
                message: "3MF enthält eine nicht-endliche Druckzeit".to_string(),
            });
        }
        None => prusa_time_hours,
    };
    let filament_volumes_cm3 = if slice_volumes.is_empty() {
        prusa_volumes
    } else {
        slice_volumes
    };

    let main = models.get(&main_key).ok_or_else(|| IoError::Corrupt {
        message: "Hauptmodell fehlt".to_string(),
    })?;
    let main_bases = main.base_materials.clone();
    let unit_scale = main.unit_scale;
    let mut items = main
        .build_items
        .iter()
        .filter(|item| item.printable)
        .map(|item| ((main_key.clone(), item.objectid), item.transform))
        .collect::<Vec<_>>();
    if items.is_empty() {
        items = fallback_items(&models, &main_key);
    }
    if items.is_empty() {
        return Err(IoError::Corrupt {
            message: "3MF enthält keine druckbare Geometrie".to_string(),
        });
    }
    let object_count = items.len() as u32;

    let mut geometry = Geometry::default();
    let mut materials = Vec::new();
    let mut stack = Vec::new();
    for (key, transform) in &items {
        visit(
            &models,
            key,
            *transform,
            unit_scale,
            &main_bases,
            &mut stack,
            &mut geometry,
            &mut materials,
        )?;
    }
    if geometry.vertices == 0 {
        return Err(IoError::Corrupt {
            message: "3MF enthält keine Dreiecke".to_string(),
        });
    }
    if !geometry.volume_mm3.is_finite()
        || geometry
            .min
            .iter()
            .chain(geometry.max.iter())
            .any(|value| !value.is_finite())
    {
        return Err(IoError::Corrupt {
            message: "3MF enthält nicht-endliche Geometrie".to_string(),
        });
    }

    let dimensions_mm = Some(
        [0, 1, 2]
            .map(|axis| decimal_from_f64(round_to(geometry.max[axis] - geometry.min[axis], 3))),
    );
    let volume_cm3 = decimal_from_f64(round_to(geometry.volume_mm3.abs() / 1000.0, 6));
    if filament_volumes_cm3
        .iter()
        .any(|volume| !volume.is_finite())
    {
        return Err(IoError::Corrupt {
            message: "3MF enthält nicht-endliche Filamentmengen".to_string(),
        });
    }
    let filament_volumes_cm3 = filament_volumes_cm3
        .into_iter()
        .filter(|volume| *volume > 0.0)
        .map(|volume| decimal_from_f64(round_to(volume, 6)))
        .collect();

    Ok(ThreeMfInfo {
        volume_cm3,
        dimensions_mm,
        object_count,
        material_names: materials,
        estimated_time_hours,
        filament_volumes_cm3,
        detected_slicer: detected_slicer(main, has_prusa_config),
    })
}

/// Ein Objekt innerhalb einer Modelldatei.
#[derive(Debug, Default)]
struct ObjectDef {
    vertices: Vec<[f64; 3]>,
    triangles: Vec<[u32; 3]>,
    components: Vec<ComponentDef>,
    material_refs: Vec<(u32, usize)>,
}

/// Eine verschachtelte Komponentenreferenz.
#[derive(Debug, Clone)]
struct ComponentDef {
    objectid: u32,
    path: Option<String>,
    transform: Transform,
}

/// Ein Build-Item (Objektinstanz auf der Platte).
#[derive(Debug, Clone, Copy)]
struct BuildItem {
    objectid: u32,
    transform: Transform,
    printable: bool,
}

/// Eine geparste Modelldatei.
#[derive(Debug)]
struct ModelData {
    objects: BTreeMap<u32, ObjectDef>,
    base_materials: BTreeMap<u32, Vec<String>>,
    build_items: Vec<BuildItem>,
    unit_scale: f64,
    app_name: Option<String>,
}

impl Default for ModelData {
    fn default() -> Self {
        Self {
            objects: BTreeMap::new(),
            base_materials: BTreeMap::new(),
            build_items: Vec::new(),
            unit_scale: 1.0,
            app_name: None,
        }
    }
}

/// Eine affine 3×4-Transformation (3MF: Zeilenvektoren, letzte Zeile implizit).
#[derive(Debug, Clone, Copy)]
struct Transform {
    matrix: [[f64; 3]; 3],
    translation: [f64; 3],
}

impl Default for Transform {
    fn default() -> Self {
        Self::identity()
    }
}

impl Transform {
    /// Identität.
    fn identity() -> Self {
        Self {
            matrix: [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
            translation: [0.0, 0.0, 0.0],
        }
    }

    /// Wendet die Transformation auf einen Punkt an.
    fn apply(self, point: [f64; 3]) -> [f64; 3] {
        let [x, y, z] = point;
        let m = self.matrix;
        [
            x * m[0][0] + y * m[1][0] + z * m[2][0] + self.translation[0],
            x * m[0][1] + y * m[1][1] + z * m[2][1] + self.translation[1],
            x * m[0][2] + y * m[1][2] + z * m[2][2] + self.translation[2],
        ]
    }
}

/// Verkettet zwei Transformationen: erst `first`, dann `second`.
fn compose(first: Transform, second: Transform) -> Transform {
    let mut matrix = [[0.0; 3]; 3];
    for (row, values) in matrix.iter_mut().enumerate() {
        for (column, value) in values.iter_mut().enumerate() {
            *value = (0..3)
                .map(|index| first.matrix[row][index] * second.matrix[index][column])
                .sum();
        }
    }
    Transform {
        matrix,
        translation: second.apply(first.translation),
    }
}

/// Sammelt Volumen und Begrenzungsrahmen über alle Build-Items.
#[derive(Debug)]
struct Geometry {
    volume_mm3: f64,
    min: [f64; 3],
    max: [f64; 3],
    vertices: usize,
}

impl Default for Geometry {
    fn default() -> Self {
        Self {
            volume_mm3: 0.0,
            min: [f64::INFINITY; 3],
            max: [f64::NEG_INFINITY; 3],
            vertices: 0,
        }
    }
}

impl Geometry {
    /// Fügt ein Dreieck in Weltkoordinaten hinzu.
    fn add_triangle(&mut self, a: [f64; 3], b: [f64; 3], c: [f64; 3]) {
        for point in [a, b, c] {
            for (axis, coordinate) in point.iter().enumerate() {
                self.min[axis] = self.min[axis].min(*coordinate);
                self.max[axis] = self.max[axis].max(*coordinate);
            }
        }
        self.vertices += 3;
        self.volume_mm3 += signed_volume(a, b, c);
    }
}

/// Signiertes Tetraeder-Volumen eines Dreiecks mit dem Ursprung.
fn signed_volume(a: [f64; 3], b: [f64; 3], c: [f64; 3]) -> f64 {
    (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
        + a[2] * (b[0] * c[1] - b[1] * c[0]))
        / 6.0
}

/// Läuft rekursiv durch ein Objekt und seine Komponenten.
#[allow(clippy::too_many_arguments)]
fn visit(
    models: &BTreeMap<String, ModelData>,
    key: &(String, u32),
    transform: Transform,
    scale: f64,
    main_bases: &BTreeMap<u32, Vec<String>>,
    stack: &mut Vec<(String, u32)>,
    geometry: &mut Geometry,
    materials: &mut Vec<String>,
) -> IoResult<()> {
    if stack.len() >= MAX_COMPONENT_DEPTH {
        return Err(IoError::Corrupt {
            message: format!(
                "3MF verschachtelt Komponenten tiefer als {MAX_COMPONENT_DEPTH} Ebenen"
            ),
        });
    }
    if stack.iter().any(|entry| entry == key) {
        return Err(IoError::Corrupt {
            message: "3MF enthält eine zyklische Komponentenreferenz".to_string(),
        });
    }

    let model = models.get(&key.0).ok_or_else(|| IoError::Corrupt {
        message: format!("3MF-Modelldatei '{}' fehlt", key.0),
    })?;
    let object = model.objects.get(&key.1).ok_or_else(|| IoError::Corrupt {
        message: format!("3MF-Objekt {} fehlt in '{}'", key.1, key.0),
    })?;
    stack.push(key.clone());

    for (pid, pindex) in &object.material_refs {
        let name = model
            .base_materials
            .get(pid)
            .and_then(|bases| bases.get(*pindex))
            .or_else(|| main_bases.get(pid).and_then(|bases| bases.get(*pindex)));
        if let Some(name) = name {
            push_unique(materials, name);
        }
    }

    for triangle in &object.triangles {
        let a = object
            .vertices
            .get(triangle[0] as usize)
            .ok_or_else(|| invalid_index(triangle[0], object.vertices.len()))?;
        let b = object
            .vertices
            .get(triangle[1] as usize)
            .ok_or_else(|| invalid_index(triangle[1], object.vertices.len()))?;
        let c = object
            .vertices
            .get(triangle[2] as usize)
            .ok_or_else(|| invalid_index(triangle[2], object.vertices.len()))?;
        geometry.add_triangle(
            world_point(*a, transform, scale),
            world_point(*b, transform, scale),
            world_point(*c, transform, scale),
        );
    }

    for component in &object.components {
        let child_path = component
            .path
            .as_deref()
            .map(normalize_path)
            .unwrap_or_else(|| key.0.clone());
        let child_key = (child_path, component.objectid);
        visit(
            models,
            &child_key,
            compose(component.transform, transform),
            scale,
            main_bases,
            stack,
            geometry,
            materials,
        )?;
    }

    stack.pop();
    Ok(())
}

/// Erzeugt einen Fehler für einen Dreiecksindex außerhalb des Meshes.
fn invalid_index(index: u32, len: usize) -> IoError {
    IoError::Corrupt {
        message: format!("3MF-Dreieck verweist auf Vertex {index} (Mesh hat {len})"),
    }
}

/// Transformiert einen Punkt und wendet den Modellmaßstab an.
fn world_point(point: [f64; 3], transform: Transform, scale: f64) -> [f64; 3] {
    let point = transform.apply(point);
    [point[0] * scale, point[1] * scale, point[2] * scale]
}

/// Fallback, wenn das Hauptmodell keine Build-Items hat: alle nicht
/// referenzierten Objekte werden als Instanzen behandelt.
fn fallback_items(
    models: &BTreeMap<String, ModelData>,
    main_key: &str,
) -> Vec<((String, u32), Transform)> {
    let mut referenced = BTreeSet::new();
    for (path, model) in models {
        for object in model.objects.values() {
            for component in &object.components {
                let child_path = component
                    .path
                    .as_deref()
                    .map(normalize_path)
                    .unwrap_or_else(|| path.clone());
                referenced.insert((child_path, component.objectid));
            }
        }
    }

    let mut items = Vec::new();
    if let Some(main) = models.get(main_key) {
        for id in main.objects.keys() {
            if !referenced.contains(&(main_key.to_string(), *id)) {
                items.push(((main_key.to_string(), *id), Transform::identity()));
            }
        }
    }
    if items.is_empty() {
        for (path, model) in models {
            for id in model.objects.keys() {
                if !referenced.contains(&(path.clone(), *id)) {
                    items.push(((path.clone(), *id), Transform::identity()));
                }
            }
        }
    }
    items
}

/// Parst eine Modelldatei.
fn parse_model(xml: &str) -> IoResult<ModelData> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut builder = ModelBuilder::default();

    loop {
        match reader.read_event() {
            Err(error) => {
                return Err(IoError::Corrupt {
                    message: format!("3MF-XML ist unlesbar: {error}"),
                });
            }
            Ok(Event::Eof) => break,
            Ok(Event::Start(element)) => builder.element(&element, true)?,
            Ok(Event::Empty(element)) => builder.element(&element, false)?,
            Ok(Event::End(element)) => builder.end(element.local_name().as_ref()),
            Ok(Event::Text(text)) if builder.metadata_name.is_some() => {
                builder
                    .metadata_text
                    .push_str(&text.xml_content(XmlVersion::Implicit1_0));
            }
            _ => {}
        }
    }

    builder.finish()
}

/// Zustand beim Parsen einer Modelldatei.
#[derive(Default)]
struct ModelBuilder {
    data: ModelData,
    current_base: Option<u32>,
    current_object: Option<u32>,
    in_vertices: bool,
    in_triangles: bool,
    in_components: bool,
    in_build: bool,
    metadata_name: Option<String>,
    metadata_text: String,
}

impl ModelBuilder {
    /// Verarbeitet ein Start- oder Empty-Element.
    fn element(&mut self, element: &BytesStart<'_>, is_start: bool) -> IoResult<()> {
        match element.local_name().as_ref() {
            "model" => {
                self.data.unit_scale = parse_unit(attr(element, "unit").as_deref())?;
            }
            "metadata" => {
                let name = attr(element, "name");
                if is_start {
                    self.metadata_name = name.clone();
                    self.metadata_text.clear();
                }
                if let Some(value) = attr(element, "value")
                    && name
                        .as_deref()
                        .is_some_and(|name| name.eq_ignore_ascii_case("application"))
                {
                    self.data.app_name = Some(value);
                }
            }
            "basematerials" => {
                if is_start {
                    self.current_base = optional_u32(element, "id")?;
                    if let Some(id) = self.current_base {
                        self.data.base_materials.entry(id).or_default();
                    }
                }
            }
            "base" => {
                if let Some(id) = self.current_base
                    && let Some(name) = attr(element, "name")
                {
                    self.data.base_materials.entry(id).or_default().push(name);
                }
            }
            "object" => {
                let id = require_u32(element, "id")?;
                let mut object = ObjectDef::default();
                if let Some(pid) = optional_u32(element, "pid")? {
                    let pindex = optional_u32(element, "pindex")?.unwrap_or(0) as usize;
                    object.material_refs.push((pid, pindex));
                }
                self.data.objects.insert(id, object);
                if is_start {
                    self.current_object = Some(id);
                }
            }
            "vertices" => {
                if is_start {
                    self.in_vertices = true;
                }
            }
            "vertex"
                if self.in_vertices
                    && let Some(id) = self.current_object
                    && let Some(object) = self.data.objects.get_mut(&id) =>
            {
                object.vertices.push([
                    require_f64(element, "x")?,
                    require_f64(element, "y")?,
                    require_f64(element, "z")?,
                ]);
            }
            "triangles" => {
                if is_start {
                    self.in_triangles = true;
                }
            }
            "triangle"
                if self.in_triangles
                    && let Some(id) = self.current_object
                    && let Some(object) = self.data.objects.get_mut(&id) =>
            {
                object.triangles.push([
                    require_u32(element, "v1")?,
                    require_u32(element, "v2")?,
                    require_u32(element, "v3")?,
                ]);
                if let Some(pid) = optional_u32(element, "pid")? {
                    let pindex = optional_u32(element, "pindex")?.unwrap_or(0) as usize;
                    object.material_refs.push((pid, pindex));
                }
            }
            "components" => {
                if is_start {
                    self.in_components = true;
                }
            }
            "component"
                if self.in_components
                    && let Some(id) = self.current_object
                    && let Some(object) = self.data.objects.get_mut(&id) =>
            {
                object.components.push(ComponentDef {
                    objectid: require_u32(element, "objectid")?,
                    path: attr(element, "path"),
                    transform: attr(element, "transform")
                        .as_deref()
                        .map(parse_transform)
                        .transpose()?
                        .unwrap_or_default(),
                });
            }
            "build" => {
                if is_start {
                    self.in_build = true;
                }
            }
            "item" if self.in_build => {
                self.data.build_items.push(BuildItem {
                    objectid: require_u32(element, "objectid")?,
                    transform: attr(element, "transform")
                        .as_deref()
                        .map(parse_transform)
                        .transpose()?
                        .unwrap_or_default(),
                    printable: optional_u32(element, "printable")?.unwrap_or(1) != 0,
                });
            }
            _ => {}
        }
        Ok(())
    }

    /// Verarbeitet ein End-Element.
    fn end(&mut self, name: &str) {
        match name {
            "metadata" => {
                if self
                    .metadata_name
                    .as_deref()
                    .is_some_and(|name| name.eq_ignore_ascii_case("application"))
                {
                    let value = self.metadata_text.trim();
                    if !value.is_empty() {
                        self.data.app_name = Some(value.to_string());
                    }
                }
                self.metadata_name = None;
                self.metadata_text.clear();
            }
            "basematerials" => self.current_base = None,
            "object" => self.current_object = None,
            "vertices" => self.in_vertices = false,
            "triangles" => self.in_triangles = false,
            "components" => self.in_components = false,
            "build" => self.in_build = false,
            _ => {}
        }
    }

    /// Schließt das Modell ab.
    fn finish(self) -> IoResult<ModelData> {
        Ok(self.data)
    }
}

/// Parst `Metadata/slice_info.config` (Bambu Studio / OrcaSlicer).
///
/// Liefert die summierte geschätzte Zeit in Sekunden und das Filamentvolumen
/// je Extruder in cm³. `used_m` wird mit dem Standarddurchmesser 1,75 mm
/// umgerechnet; `used_g` allein reicht für ein Volumen nicht aus.
///
/// Metadaten sind **best effort**: Ein unbekanntes Feld oder eine beschädigte
/// Datei darf den geometrischen Import nicht verhindern.
fn parse_slice_info(xml: &str) -> (Option<f64>, Vec<f64>) {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut seconds = 0.0;
    let mut found_time = false;
    let mut volumes = Vec::new();

    loop {
        match reader.read_event() {
            Err(_) => break,
            Ok(Event::Eof) => break,
            Ok(Event::Start(element)) | Ok(Event::Empty(element)) => {
                match element.local_name().as_ref() {
                    "metadata" => {
                        let key = attr(&element, "key").unwrap_or_default();
                        let is_time = key.eq_ignore_ascii_case("predicted_time")
                            || key.eq_ignore_ascii_case("print_time");
                        if is_time && let Some(value) = number_attr(&element, "value") {
                            seconds += value;
                            found_time = true;
                        }
                    }
                    "filament" => {
                        if let Some(meters) = number_attr(&element, "used_m")
                            && meters > 0.0
                        {
                            volumes.push(meters * FILAMENT_CM3_PER_METER);
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }

    (if found_time { Some(seconds) } else { None }, volumes)
}

/// Parst `Metadata/Slic3r_PE.config` (PrusaSlicer).
///
/// Liefert die Druckzeit in Stunden und das Filamentvolumen je Extruder in
/// cm³. Bevorzugt wird `filament used [cm3]`; fehlt die Zeile, wird
/// `filament used [mm]` mit dem angegebenen Durchmesser umgerechnet.
fn parse_prusa_config(text: &str) -> (Option<Decimal>, Vec<f64>) {
    let mut time_hours = None;
    let mut diameter_mm = DEFAULT_FILAMENT_DIAMETER_MM;
    let mut cm3 = None;
    let mut mm = None;

    for line in text.lines() {
        let line = line.trim_start_matches(';').trim();
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();
        if key
            .to_ascii_lowercase()
            .starts_with("estimated printing time")
        {
            time_hours = gcode::parse_duration_hours(value);
        } else if key.eq_ignore_ascii_case("filament used [cm3]") {
            cm3 = Some(gcode::split_numbers(value));
        } else if key.eq_ignore_ascii_case("filament used [mm]") {
            mm = Some(gcode::split_numbers(value));
        } else if key.eq_ignore_ascii_case("filament_diameter")
            && let Some(first) = gcode::split_numbers(value).first()
            && *first > 0.0
        {
            diameter_mm = *first;
        }
    }

    let volumes = if let Some(cm3) = cm3 {
        cm3
    } else if let Some(mm) = mm {
        let area = std::f64::consts::PI * (diameter_mm / 2.0) * (diameter_mm / 2.0);
        mm.into_iter()
            .map(|length_mm| length_mm * area / 1000.0)
            .collect()
    } else {
        Vec::new()
    };

    (time_hours, volumes)
}

/// Bestimmt den Slicer aus dem Anwendungs-Metadatensatz.
fn detected_slicer(main: &ModelData, has_prusa_config: bool) -> Option<String> {
    if let Some(application) = &main.app_name {
        let lower = application.to_ascii_lowercase();
        if lower.contains("bambu") {
            return Some("BambuStudio".to_string());
        }
        if lower.contains("orca") {
            return Some("OrcaSlicer".to_string());
        }
        if lower.contains("prusa") {
            return Some("PrusaSlicer".to_string());
        }
        if lower.contains("slic3r") {
            return Some("Slic3r".to_string());
        }
        let trimmed = application.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    if has_prusa_config {
        return Some("PrusaSlicer".to_string());
    }
    None
}

/// Parst eine 3MF-Transformationsmatrix (12 Zahlen, Zeilenvektoren).
fn parse_transform(value: &str) -> IoResult<Transform> {
    let numbers = value
        .split_whitespace()
        .map(|number| number.parse::<f64>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| IoError::Corrupt {
            message: format!("3MF-Transform enthält keine gültigen Zahlen: {error}"),
        })?;
    if numbers.len() != 12 {
        return Err(IoError::Corrupt {
            message: format!(
                "3MF-Transform braucht 12 Zahlen, gefunden {}",
                numbers.len()
            ),
        });
    }
    let mut matrix = [[0.0; 3]; 3];
    for (index, value) in numbers.iter().take(9).enumerate() {
        matrix[index / 3][index % 3] = *value;
    }
    Ok(Transform {
        matrix,
        translation: [numbers[9], numbers[10], numbers[11]],
    })
}

/// Übersetzt die 3MF-Einheit in einen Millimeter-Faktor.
fn parse_unit(unit: Option<&str>) -> IoResult<f64> {
    match unit.unwrap_or("millimeter").to_ascii_lowercase().as_str() {
        "micron" => Ok(0.001),
        "millimeter" => Ok(1.0),
        "centimeter" => Ok(10.0),
        "inch" => Ok(25.4),
        "foot" => Ok(304.8),
        "meter" => Ok(1000.0),
        other => Err(IoError::Unsupported {
            message: format!("3MF-Einheit '{other}' wird nicht unterstützt"),
        }),
    }
}

/// Liest eine benannte Datei aus dem ZIP, falls vorhanden.
fn read_named_entry(
    archive: &mut ZipArchive<Cursor<&[u8]>>,
    names: &[String],
    target: &str,
    limit: u64,
) -> IoResult<Option<String>> {
    let Some(name) = names
        .iter()
        .find(|name| normalize_path(name) == target)
        .cloned()
    else {
        return Ok(None);
    };
    read_entry(archive, &name, limit).map(Some)
}

/// Liest einen ZIP-Eintrag als UTF-8-Text mit Größenlimit.
fn read_entry(archive: &mut ZipArchive<Cursor<&[u8]>>, name: &str, limit: u64) -> IoResult<String> {
    let file = archive.by_name(name).map_err(|error| IoError::Corrupt {
        message: format!("3MF-Eintrag '{name}' ist unlesbar: {error}"),
    })?;
    if file.size() > limit {
        return Err(IoError::Corrupt {
            message: format!(
                "3MF-Eintrag '{name}' ist zu groß ({} Byte, maximal {limit})",
                file.size()
            ),
        });
    }
    let mut content = String::new();
    file.take(limit + 1)
        .read_to_string(&mut content)
        .map_err(|error| IoError::Corrupt {
            message: format!("3MF-Eintrag '{name}' ist kein gültiges UTF-8: {error}"),
        })?;
    if content.len() as u64 > limit {
        return Err(IoError::Corrupt {
            message: format!("3MF-Eintrag '{name}' ist zu groß (maximal {limit} Byte)"),
        });
    }
    Ok(content)
}

/// Normalisiert einen ZIP-Pfad für den Vergleich (ohne führenden `/`).
fn normalize_path(path: &str) -> String {
    path.replace('\\', "/")
        .trim_start_matches('/')
        .to_ascii_lowercase()
}

/// Liest ein Attribut ohne Namensraum-Präfix.
fn attr(element: &BytesStart<'_>, name: &str) -> Option<String> {
    element
        .attributes()
        .flatten()
        .find(|attribute| attribute.key.local_name().as_ref() == name)
        .and_then(|attribute| {
            attribute
                .normalized_value(XmlVersion::Implicit1_0)
                .ok()
                .map(|value| value.into_owned())
        })
}

/// Liest ein optionales `u32`-Attribut.
fn optional_u32(element: &BytesStart<'_>, name: &str) -> IoResult<Option<u32>> {
    attr(element, name)
        .map(|value| {
            value.parse::<u32>().map_err(|error| IoError::Corrupt {
                message: format!("3MF-Attribut '{name}' ist keine Zahl: {error}"),
            })
        })
        .transpose()
}

/// Liest ein Pflicht-`u32`-Attribut.
fn require_u32(element: &BytesStart<'_>, name: &str) -> IoResult<u32> {
    optional_u32(element, name)?.ok_or_else(|| IoError::Corrupt {
        message: format!("3MF-Attribut '{name}' fehlt"),
    })
}

/// Liest ein optionales `f64`-Attribut.
fn optional_f64(element: &BytesStart<'_>, name: &str) -> IoResult<Option<f64>> {
    attr(element, name)
        .map(|value| {
            value
                .trim()
                .replace(',', ".")
                .parse::<f64>()
                .map_err(|error| IoError::Corrupt {
                    message: format!("3MF-Attribut '{name}' ist keine Zahl: {error}"),
                })
        })
        .transpose()
}

/// Liest ein optionales Zahlattribut ohne Fehler (Metadaten sind best effort).
fn number_attr(element: &BytesStart<'_>, name: &str) -> Option<f64> {
    attr(element, name).and_then(|value| value.trim().replace(',', ".").parse::<f64>().ok())
}

/// Liest ein Pflicht-`f64`-Attribut.
fn require_f64(element: &BytesStart<'_>, name: &str) -> IoResult<f64> {
    optional_f64(element, name)?.ok_or_else(|| IoError::Corrupt {
        message: format!("3MF-Attribut '{name}' fehlt"),
    })
}

/// Hängt einen Materialnamen an, falls er noch nicht vorhanden ist.
fn push_unique(values: &mut Vec<String>, value: &str) {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return;
    }
    if !values.iter().any(|existing| existing == trimmed) {
        values.push(trimmed.to_string());
    }
}

/// Rundet auf die angegebene Anzahl Nachkommastellen.
fn round_to(value: f64, decimals: i32) -> f64 {
    let factor = 10f64.powi(decimals);
    (value * factor).round() / factor
}

/// Wandelt ein `f64` über die kürzeste String-Darstellung in `Decimal` um.
fn decimal_from_f64(value: f64) -> Decimal {
    if !value.is_finite() {
        return Decimal::ZERO;
    }
    value
        .to_string()
        .parse::<Decimal>()
        .unwrap_or(Decimal::ZERO)
}
