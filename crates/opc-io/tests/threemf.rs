//! Integrationstests des 3MF-Imports.
//!
//! Die Fixtures werden im Speicher als ZIP-Paket gebaut — kein Dateisystem,
//! kein Netzwerk. Geprüft werden Mesh-Volumen, Transformationen, verschachtelte
//! Komponenten (Bambu-/Orca-Struktur) und die Metadaten von Bambu Studio,
//! OrcaSlicer und PrusaSlicer.

use opc_io::{IoError, parse_3mf};
use rust_decimal_macros::dec;
use std::io::{Cursor, Write};
use zip::ZipWriter;
use zip::write::SimpleFileOptions;

/// Baut ein 3MF-Paket aus (Pfad, Inhalt)-Paaren.
fn package(files: &[(&str, &str)]) -> Vec<u8> {
    let mut buffer = Cursor::new(Vec::new());
    {
        let mut zip = ZipWriter::new(&mut buffer);
        for (name, content) in files {
            zip.start_file(*name, SimpleFileOptions::default())
                .expect("ZIP-Eintrag");
            zip.write_all(content.as_bytes()).expect("ZIP-Inhalt");
        }
        zip.finish().expect("ZIP abschließen");
    }
    buffer.into_inner()
}

/// Erzeugt ein Würfel-Mesh mit der Kantenlänge `size` im Ursprung.
fn cube_mesh(size: f64) -> String {
    let s = size;
    format!(
        "<mesh>
          <vertices>
            <vertex x=\"0\" y=\"0\" z=\"0\"/>
            <vertex x=\"{s}\" y=\"0\" z=\"0\"/>
            <vertex x=\"{s}\" y=\"{s}\" z=\"0\"/>
            <vertex x=\"0\" y=\"{s}\" z=\"0\"/>
            <vertex x=\"0\" y=\"0\" z=\"{s}\"/>
            <vertex x=\"{s}\" y=\"0\" z=\"{s}\"/>
            <vertex x=\"{s}\" y=\"{s}\" z=\"{s}\"/>
            <vertex x=\"0\" y=\"{s}\" z=\"{s}\"/>
          </vertices>
          <triangles>
            <triangle v1=\"0\" v2=\"2\" v3=\"1\"/>
            <triangle v1=\"0\" v2=\"3\" v3=\"2\"/>
            <triangle v1=\"4\" v2=\"5\" v3=\"6\"/>
            <triangle v1=\"4\" v2=\"6\" v3=\"7\"/>
            <triangle v1=\"0\" v2=\"1\" v3=\"5\"/>
            <triangle v1=\"0\" v2=\"5\" v3=\"4\"/>
            <triangle v1=\"3\" v2=\"7\" v3=\"6\"/>
            <triangle v1=\"3\" v2=\"6\" v3=\"2\"/>
            <triangle v1=\"0\" v2=\"4\" v3=\"7\"/>
            <triangle v1=\"0\" v2=\"7\" v3=\"3\"/>
            <triangle v1=\"1\" v2=\"2\" v3=\"6\"/>
            <triangle v1=\"1\" v2=\"6\" v3=\"5\"/>
          </triangles>
        </mesh>"
    )
}

/// Ein Modell mit einem einzigen Würfel und einem Build-Item.
fn cube_model(size: f64, build_transform: Option<&str>) -> String {
    let transform = build_transform
        .map(|value| format!(" transform=\"{value}\""))
        .unwrap_or_default();
    format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>
         <model unit=\"millimeter\">
           <resources>
             <object id=\"1\" type=\"model\">{}</object>
           </resources>
           <build><item objectid=\"1\"{transform}/></build>
         </model>",
        cube_mesh(size)
    )
}

#[test]
fn leerer_oder_kaputter_inhalt_ist_ein_fehler() {
    assert_eq!(parse_3mf(&[]), Err(IoError::Empty));
    assert!(matches!(
        parse_3mf(b"kein zip"),
        Err(IoError::Corrupt { .. })
    ));

    let without_model = package(&[("README.txt", "kein Modell")]);
    assert!(matches!(
        parse_3mf(&without_model),
        Err(IoError::Corrupt { .. })
    ));
}

#[test]
fn wuerfel_liefert_volumen_und_masse() {
    let bytes = package(&[("3D/3dmodel.model", &cube_model(10.0, None))]);
    let info = parse_3mf(&bytes).expect("3MF muss parsen");

    assert_eq!(info.volume_cm3, dec!(1));
    assert_eq!(info.dimensions_mm, Some([dec!(10), dec!(10), dec!(10)]));
    assert_eq!(info.object_count, 1);
    assert!(info.material_names.is_empty());
    assert_eq!(info.estimated_time_hours, None);
    assert!(info.filament_volumes_cm3.is_empty());
    assert_eq!(info.detected_slicer, None);
}

#[test]
fn build_transform_skaliert_und_verschiebt() {
    let scaled = package(&[(
        "3D/3dmodel.model",
        &cube_model(10.0, Some("2 0 0 0 2 0 0 0 2 0 0 0")),
    )]);
    let info = parse_3mf(&scaled).expect("skaliertes 3MF");
    assert_eq!(info.volume_cm3, dec!(8));
    assert_eq!(info.dimensions_mm, Some([dec!(20), dec!(20), dec!(20)]));

    let moved = package(&[(
        "3D/3dmodel.model",
        &cube_model(10.0, Some("1 0 0 0 1 0 0 0 1 5 6 7")),
    )]);
    let info = parse_3mf(&moved).expect("verschobenes 3MF");
    assert_eq!(info.volume_cm3, dec!(1));
    assert_eq!(info.dimensions_mm, Some([dec!(10), dec!(10), dec!(10)]));
}

#[test]
fn mehrere_build_items_werden_summiert() {
    let model = format!(
        "<?xml version=\"1.0\"?>
         <model unit=\"millimeter\">
           <resources><object id=\"1\" type=\"model\">{}</object></resources>
           <build>
             <item objectid=\"1\"/>
             <item objectid=\"1\" transform=\"1 0 0 0 1 0 0 0 1 20 0 0\"/>
             <item objectid=\"1\" printable=\"0\"/>
           </build>
         </model>",
        cube_mesh(10.0)
    );
    let bytes = package(&[("3D/3dmodel.model", &model)]);
    let info = parse_3mf(&bytes).expect("3MF muss parsen");

    assert_eq!(info.object_count, 2);
    assert_eq!(info.volume_cm3, dec!(2));
    assert_eq!(info.dimensions_mm, Some([dec!(30), dec!(10), dec!(10)]));
}

#[test]
fn materialien_werden_aus_basematerials_gelesen() {
    let model = format!(
        "<?xml version=\"1.0\"?>
         <model unit=\"millimeter\">
           <resources>
             <basematerials id=\"1\">
               <base name=\"PLA\"/>
               <base name=\"PETG\"/>
             </basematerials>
             <object id=\"2\" type=\"model\" pid=\"1\" pindex=\"1\">{}</object>
           </resources>
           <build><item objectid=\"2\"/></build>
         </model>",
        cube_mesh(10.0)
    );
    let bytes = package(&[("3D/3dmodel.model", &model)]);
    let info = parse_3mf(&bytes).expect("3MF muss parsen");
    assert_eq!(info.material_names, vec!["PETG".to_string()]);
}

#[test]
fn einheit_zentimeter_wird_in_millimeter_umgerechnet() {
    let model = format!(
        "<?xml version=\"1.0\"?>
         <model unit=\"centimeter\">
           <resources><object id=\"1\" type=\"model\">{}</object></resources>
           <build><item objectid=\"1\"/></build>
         </model>",
        cube_mesh(1.0)
    );
    let bytes = package(&[("3D/3dmodel.model", &model)]);
    let info = parse_3mf(&bytes).expect("3MF muss parsen");
    assert_eq!(info.volume_cm3, dec!(1));
    assert_eq!(info.dimensions_mm, Some([dec!(10), dec!(10), dec!(10)]));
}

#[test]
fn unbekannte_einheit_wird_abgelehnt() {
    let model = cube_model(10.0, None).replace("millimeter", "parsec");
    let bytes = package(&[("3D/3dmodel.model", &model)]);
    assert!(matches!(
        parse_3mf(&bytes),
        Err(IoError::Unsupported { .. })
    ));
}

#[test]
fn bambu_komponenten_und_slice_info_werden_gelesen() {
    let main_model = "<?xml version=\"1.0\"?>
      <model unit=\"millimeter\">
        <metadata name=\"Application\">BambuStudio-01.09.03.50</metadata>
        <resources>
          <object id=\"1\" type=\"model\">
            <components>
              <component objectid=\"2\" p:path=\"/3D/Objects/object_1.model\"/>
            </components>
          </object>
        </resources>
        <build><item objectid=\"1\"/></build>
      </model>";
    let sub_model = format!(
        "<?xml version=\"1.0\"?>
         <model unit=\"millimeter\">
           <resources>
             <basematerials id=\"1\"><base name=\"PLA Basic\"/></basematerials>
             <object id=\"2\" type=\"model\" pid=\"1\" pindex=\"0\">{}</object>
           </resources>
         </model>",
        cube_mesh(10.0)
    );
    let slice_info = "<?xml version=\"1.0\"?>
      <config>
        <plate>
          <metadata key=\"predicted_time\" value=\"3600\"/>
          <filament id=\"1\" type=\"PLA\" used_m=\"10\"/>
        </plate>
      </config>";
    let bytes = package(&[
        ("3D/3dmodel.model", main_model),
        ("3D/Objects/object_1.model", &sub_model),
        ("Metadata/slice_info.config", slice_info),
    ]);
    let info = parse_3mf(&bytes).expect("Bambu-3MF muss parsen");

    assert_eq!(info.volume_cm3, dec!(1));
    assert_eq!(info.material_names, vec!["PLA Basic".to_string()]);
    assert_eq!(info.estimated_time_hours, Some(dec!(1)));
    assert_eq!(info.filament_volumes_cm3, vec![dec!(24.052814)]);
    assert_eq!(info.detected_slicer.as_deref(), Some("BambuStudio"));
}

#[test]
fn prusa_konfiguration_liefert_zeit_und_filament() {
    let config = "; estimated printing time (normal mode) = 1h 2m 3s
; filament used [cm3] = 2.5, 1.5
; filament_diameter = 1.75";
    let bytes = package(&[
        ("3D/3dmodel.model", &cube_model(10.0, None)),
        ("Metadata/Slic3r_PE.config", config),
    ]);
    let info = parse_3mf(&bytes).expect("Prusa-3MF muss parsen");

    assert_eq!(info.volume_cm3, dec!(1));
    assert_eq!(info.filament_volumes_cm3, vec![dec!(2.5), dec!(1.5)]);
    assert_eq!(info.detected_slicer.as_deref(), Some("PrusaSlicer"));
    let hours = info.estimated_time_hours.expect("Zeit fehlt");
    assert_eq!(hours, dec!(1) + dec!(2) / dec!(60) + dec!(3) / dec!(3600));
}

#[test]
fn beschaedigte_slicer_metadaten_blockieren_den_import_nicht() {
    let bytes = package(&[
        ("3D/3dmodel.model", &cube_model(10.0, None)),
        (
            "Metadata/slice_info.config",
            "<config><metadata key=\"predicted_time\" value=\"1h\"/></config>",
        ),
    ]);
    let info = parse_3mf(&bytes).expect("Geometrie muss trotz Metadatenfehler lesbar sein");
    assert_eq!(info.volume_cm3, dec!(1));
    assert_eq!(info.estimated_time_hours, None);

    let broken = package(&[
        ("3D/3dmodel.model", &cube_model(10.0, None)),
        ("Metadata/slice_info.config", "<config><metadata"),
    ]);
    let info = parse_3mf(&broken).expect("kaputte Metadaten dürfen nicht abbrechen");
    assert_eq!(info.volume_cm3, dec!(1));
}

#[test]
fn zyklische_komponenten_werden_abgelehnt() {
    let model = "<?xml version=\"1.0\"?>
      <model unit=\"millimeter\">
        <resources>
          <object id=\"1\"><components><component objectid=\"1\"/></components></object>
        </resources>
        <build><item objectid=\"1\"/></build>
      </model>";
    let bytes = package(&[("3D/3dmodel.model", model)]);
    assert!(matches!(parse_3mf(&bytes), Err(IoError::Corrupt { .. })));
}

#[test]
fn dreiecksindex_ausserhalb_des_meshes_wird_abgelehnt() {
    let model = "<?xml version=\"1.0\"?>
      <model unit=\"millimeter\">
        <resources>
          <object id=\"1\">
            <mesh>
              <vertices><vertex x=\"0\" y=\"0\" z=\"0\"/></vertices>
              <triangles><triangle v1=\"0\" v2=\"1\" v3=\"2\"/></triangles>
            </mesh>
          </object>
        </resources>
        <build><item objectid=\"1\"/></build>
      </model>";
    let bytes = package(&[("3D/3dmodel.model", model)]);
    assert!(matches!(parse_3mf(&bytes), Err(IoError::Corrupt { .. })));
}
