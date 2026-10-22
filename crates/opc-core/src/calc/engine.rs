//! Orchestrierung der Kostenberechnung.
//!
//! Die Engine ist **pure**: keine Dateisystemzugriffe, kein Netzwerk, kein
//! globaler Zustand, keine Uhr. Zeitstempel werden vom Aufrufer geliefert
//! (Spec 0003, Akzeptanzkriterium 8).
//!
//! # Kostenblöcke und ihre Ebene
//!
//! Die Marge und die Steuer werden — wie in der Apache-2.0-Referenzbibliothek
//! — **je Datei** berechnet. Jede Datei bildet eine eigene Kostenbasis:
//!
//! 1. Materialkosten (§ 4.2)
//! 2. Maschinenkosten (§ 4.3)
//! 3. Energiekosten (§ 4.4)
//! 4. Verfahrensspezifische Zuschläge (§ 4.7)
//! 5. Arbeitsschritte *pro Stück* (§ 4.5)
//! 6. Zusatzartikel der Datei
//! 7. Handlungspauschale *je Datei* (§ 4.8)
//! 8. Prozentuale Zuschläge **vor** der Marge (§ 4.9)
//! 9. Marge (§ 4.9)
//! 10. Prozentuale Zuschläge **nach** der Marge (§ 4.9)
//! 11. Steuer (§ 4.9)
//!
//! Auf **Projektebene** folgen die Arbeitsschritte *pro Stunde* und *pro
//! Auftrag*, die projekteigenen Zusatzartikel sowie — sofern gewählt — die
//! einmalige Handlungspauschale mit einer eigenen Margeposition. Die Steuer
//! der Projektebene wird auf diese Projektkosten berechnet.
//!
//! Jeder Block erzeugt **eigene** Positionen; kein Block wird in einen anderen
//! eingerechnet. Die Fehlerrate erzeugt zusätzliche Positionen in den Blöcken
//! Material, Maschine und Energie (§ 4.10) — diese **gehören** in die
//! Gesamtkosten, denn der verworfene Druck ist bezahlt.

use crate::calc::energy;
use crate::calc::machine_hour_rate;
use crate::calc::margin;
use crate::calc::material;
use crate::calc::worksteps;
use crate::model::calculation::{
    CalculationFileInput, CalculationInput, CustomSurcharge, HandlingFeeScope, SurchargeTiming,
};
use crate::model::cost_position::{CalculationResult, CostGroup, CostPosition, FileSummary};
use crate::model::printer::PrintProcess;
use crate::model::workstep::WorkstepCalculationType;
use crate::money;
use rust_decimal::Decimal;
use uuid::Uuid;

/// Rechnet eine Kalkulation durch.
///
/// Rückgabetyp ist `Result` — fachliche Fehler (z. B. Verpackungsgröße 0)
/// werden als `Err` gemeldet und **nicht** als Panic oder stillschweigend
/// als `0` behandelt (Spec 0003, Akzeptanzkriterium 10).
pub fn calculate(input: &CalculationInput) -> Result<CalculationResult, crate::calc::CalcError> {
    let mut positions: Vec<CostPosition> = Vec::new();
    let mut file_summaries: Vec<FileSummary> = Vec::new();
    let mut base_total = Decimal::ZERO;
    let mut margin_total = Decimal::ZERO;
    let mut tax_total = Decimal::ZERO;
    let mut total = Decimal::ZERO;

    // 1) Maschinenstundensatz bestimmen (einmal für die ganze Kalkulation).
    let hourly_rate = resolve_hourly_rate(input)?;

    // 2) Je Datei: Kostenblöcke, dann Marge und Steuer der Datei.
    for file in &input.files {
        let (file_positions, summary) = calculate_file(input, file, hourly_rate)?;
        let scope = apply_margin_and_tax(input, file_positions, Some(file.id))?;
        positions.extend(scope.positions);
        base_total += scope.base;
        margin_total += scope.margin;
        tax_total += scope.tax;
        total += scope.total;
        file_summaries.push(summary);
    }

    // 3) Projektebene: Arbeitsschritte, Zusatzartikel, Handlungspauschale
    //    (einmal) und deren Steuer.
    let project_positions = calculate_project_level(input)?;
    let project_scope = apply_margin_and_tax(input, project_positions, None)?;
    positions.extend(project_scope.positions);

    // 4) Summen bilden.
    let base_total = base_total + project_scope.base;
    let margin_total = margin_total + project_scope.margin;
    let tax_total = tax_total + project_scope.tax;
    let total = total + project_scope.total;

    let mut total_position = CostPosition::new(CostGroup::Total, "Gesamtkosten", total);
    total_position.detail = Some(format!("{} €", money::format_de(total, 2)));
    positions.push(total_position);

    Ok(CalculationResult {
        id: input.id,
        project_name: input.project_name.clone(),
        created_at: input.created_at.clone(),
        positions,
        base_total,
        margin_total,
        tax_total,
        total,
        machine_hour_rate: hourly_rate,
        files: file_summaries,
    })
}

/// Bestimmt den anzuwendenden Maschinenstundensatz in €/h.
///
/// Vorrang: ein berechneter Stundensatz aus [`crate::model::HourlyRate`] —
/// fällt er 0 aus (keine Daten hinterlegt), greift der am Drucker
/// hinterlegte Stundensatz.
fn resolve_hourly_rate(input: &CalculationInput) -> Result<Decimal, crate::calc::CalcError> {
    if let Some(rate) = &input.hourly_rate {
        let computed = machine_hour_rate::calculate_hourly_rate(rate)?;
        if !computed.is_zero() {
            return Ok(computed);
        }
    }
    Ok(input.printer.hourly_rate_value().unwrap_or(Decimal::ZERO))
}

/// Rechnet alle Positionen einer Datei durch (ohne Marge und Steuer).
fn calculate_file(
    input: &CalculationInput,
    file: &CalculationFileInput,
    hourly_rate: Decimal,
) -> Result<(Vec<CostPosition>, FileSummary), crate::calc::CalcError> {
    let profile = &input.profile;
    let mut positions: Vec<CostPosition> = Vec::new();
    let quantity = file.quantity;
    let fail_rate = profile.fail_rate_percent;

    // --- Druckzeit (Spec 4.1) ---------------------------------------------
    let multiply = file
        .multiply_print_time_with_quantity
        .unwrap_or(profile.multiply_print_time_with_quantity);
    let print_time_base = if multiply {
        file.print_time_hours * Decimal::from(quantity) * profile.print_time_factor
    } else {
        file.print_time_hours
    };
    let print_time_fail = print_time_base * fail_rate / Decimal::from(100);

    // --- Materialkosten (Spec 4.2) -----------------------------------------
    let mut material_g_total = Decimal::ZERO;
    let mut material_g_fail_total = Decimal::ZERO;
    let mut entries: Vec<MaterialEntry> = Vec::new();

    for file_material in &file.materials {
        let piece_weight = material::piece_weight_g(file_material, file.weight_g, file.volume_cm3);
        let g_base = material::material_g_base(piece_weight, quantity);
        let g_fail = material::material_g_fail(g_base, fail_rate);
        let price_per_gram = material::price_per_gram(&file_material.material)?;
        let cost_base = material::material_costs_base(g_base, price_per_gram);
        let cost_fail = material::material_costs_fail(g_fail, price_per_gram);

        material_g_total += g_base;
        material_g_fail_total += g_fail;
        entries.push(MaterialEntry {
            name: file_material.material.name.clone(),
            material_id: file_material.material.id,
            g_base,
            g_fail,
            cost_base,
            cost_fail,
            price_per_gram,
        });
    }

    let combine = profile.combine_materials && entries.len() > 1;
    for position in build_material_positions(
        &entries,
        combine,
        profile.exclude_material_from_margin,
        Some(file.id),
    ) {
        push(&mut positions, position);
    }

    // --- Maschinenkosten (Spec 4.3) ----------------------------------------
    let machine_base = hourly_rate * print_time_base;
    let machine_fail = hourly_rate * print_time_fail;
    if !machine_base.is_zero() {
        let mut position = CostPosition::new(CostGroup::Machine, "Maschinenkosten", machine_base);
        position.detail = Some(format!(
            "{} h × {} €/h",
            money::format_de(print_time_base, 2),
            money::format_de(hourly_rate, 2)
        ));
        position.quantity = Some(print_time_base);
        position.unit = Some("h".to_string());
        position.file_id = Some(file.id);
        position.source_id = Some(input.printer.id);
        position.excluded_from_margin = profile.exclude_machine_from_margin;
        positions.push(position);
    }
    if !machine_fail.is_zero() {
        let mut position = CostPosition::new(
            CostGroup::Machine,
            "Maschinenkosten (Fehlerrate)",
            machine_fail,
        );
        position.detail = Some(format!(
            "{} h × {} €/h",
            money::format_de(print_time_fail, 2),
            money::format_de(hourly_rate, 2)
        ));
        position.quantity = Some(print_time_fail);
        position.unit = Some("h".to_string());
        position.file_id = Some(file.id);
        position.source_id = Some(input.printer.id);
        position.is_fail_rate = true;
        position.excluded_from_margin = profile.exclude_machine_from_margin;
        positions.push(position);
    }

    // --- Energiekosten (Spec 4.4) ------------------------------------------
    // Energiekosten bilden in der Referenz einen eigenen Typ und sind deshalb
    // **nicht** von der Margenberechnung ausnehmbar.
    if profile.apply_energy_costs {
        let power = input.printer.power_watts;
        let kwh_base =
            energy::energy_consumption_kwh(print_time_base, power, profile.power_level_percent);
        let kwh_fail =
            energy::energy_consumption_kwh(print_time_fail, power, profile.power_level_percent);
        let cost_base = kwh_base * profile.energy_price_per_kwh;
        let cost_fail = kwh_fail * profile.energy_price_per_kwh;

        if !cost_base.is_zero() {
            let mut position = CostPosition::new(CostGroup::Energy, "Energiekosten", cost_base);
            position.detail = Some(format!(
                "{} kWh × {} €/kWh",
                money::format_de(kwh_base, 3),
                money::format_de(profile.energy_price_per_kwh, 2)
            ));
            position.quantity = Some(kwh_base);
            position.unit = Some("kWh".to_string());
            position.file_id = Some(file.id);
            positions.push(position);
        }
        if !cost_fail.is_zero() {
            let mut position =
                CostPosition::new(CostGroup::Energy, "Energiekosten (Fehlerrate)", cost_fail);
            position.detail = Some(format!(
                "{} kWh × {} €/kWh",
                money::format_de(kwh_fail, 3),
                money::format_de(profile.energy_price_per_kwh, 2)
            ));
            position.quantity = Some(kwh_fail);
            position.unit = Some("kWh".to_string());
            position.file_id = Some(file.id);
            position.is_fail_rate = true;
            positions.push(position);
        }
    }

    // --- Verfahrensspezifische Zuschläge (Spec 4.7) ------------------------
    if input.printer.process == PrintProcess::Fdm {
        if let Some(cost) = input.printer.nozzle_wear_cost {
            let mut position = CostPosition::new(
                CostGroup::ProcessSurcharge,
                "Düsenverschleiß",
                cost * Decimal::from(quantity),
            );
            position.detail = Some(format!("{} × {} €", quantity, money::format_de(cost, 2)));
            position.quantity = Some(Decimal::from(quantity));
            position.unit = Some("Stk".to_string());
            position.file_id = Some(file.id);
            positions.push(position);
        }
        if let Some(cost) = input.printer.build_plate_wear_cost {
            let mut position = CostPosition::new(
                CostGroup::ProcessSurcharge,
                "Druckplattenverschleiß",
                cost * Decimal::from(quantity),
            );
            position.detail = Some(format!("{} × {} €", quantity, money::format_de(cost, 2)));
            position.quantity = Some(Decimal::from(quantity));
            position.unit = Some("Stk".to_string());
            position.file_id = Some(file.id);
            positions.push(position);
        }
        if let Some(cost) = input.printer.material_change_cost {
            let mut position = CostPosition::new(
                CostGroup::ProcessSurcharge,
                "Materialwechsel",
                cost * Decimal::from(file.material_changes),
            );
            position.detail = Some(format!(
                "{} × {} €",
                file.material_changes,
                money::format_de(cost, 2)
            ));
            position.quantity = Some(Decimal::from(file.material_changes));
            position.unit = Some("Stk".to_string());
            position.file_id = Some(file.id);
            positions.push(position);
        }
    }

    // --- Arbeitsschritte „pro Stück" (Spec 4.5) ---------------------------
    for workstep in input
        .worksteps
        .iter()
        .filter(|w| w.calculation_type == WorkstepCalculationType::PerPiece)
    {
        let amount = worksteps::per_piece(workstep, quantity);
        let mut position = CostPosition::new(CostGroup::Worksteps, workstep.name.clone(), amount);
        position.detail = Some(format!(
            "{} € × {} × {} Stk",
            money::format_de(workstep.price, 2),
            money::format_de(workstep.quantity, 2),
            quantity
        ));
        position.quantity = Some(workstep.quantity * Decimal::from(quantity));
        position.unit = Some("Stk".to_string());
        position.file_id = Some(file.id);
        position.source_id = Some(workstep.id);
        position.excluded_from_margin = profile.exclude_worksteps_from_margin;
        push(&mut positions, position);
    }

    // --- Zusatzartikel, die dieser Datei zugeordnet sind --------------------
    for item in input
        .additional_items
        .iter()
        .filter(|item| item.file_id == Some(file.id))
    {
        let amount = item.price * item.quantity;
        let mut position = CostPosition::new(CostGroup::AdditionalItems, item.name.clone(), amount);
        position.detail = Some(format!(
            "{} × {} €",
            money::format_de(item.quantity, 2),
            money::format_de(item.price, 2)
        ));
        position.quantity = Some(item.quantity);
        position.unit = Some("Stk".to_string());
        position.file_id = Some(file.id);
        position.source_id = Some(item.id);
        push(&mut positions, position);
    }

    // --- Handlungspauschale „je Datei" (Spec 4.8) --------------------------
    if profile.handling_fee_scope == HandlingFeeScope::PerFile {
        let amount = profile.handling_fee * Decimal::from(quantity);
        let mut position = CostPosition::new(CostGroup::HandlingFee, "Handlungspauschale", amount);
        position.detail = Some(format!(
            "{} € × {} Stk",
            money::format_de(profile.handling_fee, 2),
            quantity
        ));
        position.quantity = Some(Decimal::from(quantity));
        position.unit = Some("Stk".to_string());
        position.file_id = Some(file.id);
        push(&mut positions, position);
    }

    let summary = FileSummary {
        file_id: file.id,
        file_name: file.file_name.clone(),
        quantity,
        print_time_hours: print_time_base,
        print_time_hours_fail: print_time_fail,
        material_g: material_g_total,
        material_g_fail: material_g_fail_total,
    };

    Ok((positions, summary))
}

/// Rechnet alle Positionen der Projektebene durch (ohne Steuer).
fn calculate_project_level(
    input: &CalculationInput,
) -> Result<Vec<CostPosition>, crate::calc::CalcError> {
    let profile = &input.profile;
    let mut positions: Vec<CostPosition> = Vec::new();

    // --- Arbeitsschritte „pro Stunde" und „pro Auftrag" -------------------
    for workstep in &input.worksteps {
        let amount = match workstep.calculation_type {
            WorkstepCalculationType::PerHour => worksteps::per_hour(workstep),
            WorkstepCalculationType::PerOrder => worksteps::per_order(workstep),
            WorkstepCalculationType::PerPiece => continue,
        };
        let mut position = CostPosition::new(CostGroup::Worksteps, workstep.name.clone(), amount);
        position.detail = Some(workstep.calculation_type.label().to_string());
        position.quantity = Some(workstep.quantity);
        position.source_id = Some(workstep.id);
        position.excluded_from_margin = profile.exclude_worksteps_from_margin;
        push(&mut positions, position);
    }

    // --- Zusatzartikel ohne Dateizuordnung --------------------------------
    for item in input
        .additional_items
        .iter()
        .filter(|item| item.file_id.is_none())
    {
        let amount = item.price * item.quantity;
        let mut position = CostPosition::new(CostGroup::AdditionalItems, item.name.clone(), amount);
        position.detail = Some(format!(
            "{} × {} €",
            money::format_de(item.quantity, 2),
            money::format_de(item.price, 2)
        ));
        position.quantity = Some(item.quantity);
        position.unit = Some("Stk".to_string());
        position.source_id = Some(item.id);
        push(&mut positions, position);
    }

    // --- Handlungspauschale „einmal" (Spec 4.8) ---------------------------
    if profile.handling_fee_scope == HandlingFeeScope::Once {
        let mut position = CostPosition::new(
            CostGroup::HandlingFee,
            "Handlungspauschale",
            profile.handling_fee,
        );
        position.detail = Some("einmal je Kalkulation".to_string());
        push(&mut positions, position);
    }

    Ok(positions)
}

/// Die Summen einer Kostenebene (eine Datei oder das Projekt).
///
/// `base` ist die **Kostenbasis** (`kosten_basis`): alle Kostenblöcke
/// einschließlich der Zuschläge *vor* der Marge, aber ohne Marge, ohne
/// Zuschläge *nach* der Marge und ohne Steuer.
struct ScopeTotals {
    /// Positionen der Ebene.
    positions: Vec<CostPosition>,
    /// Kostenbasis vor Marge und Steuer.
    base: Decimal,
    /// Summe der Margenpositionen.
    margin: Decimal,
    /// Summe der Steuerpositionen.
    tax: Decimal,
    /// Gesamtsumme der Ebene inklusive Marge und Steuer.
    total: Decimal,
}

/// Wendet Zuschläge, Marge und Steuer auf eine Kostenbasis an.
///
/// Das ist der Block „§ 4.9" der Spec: Zuschläge vor der Marge, Marge,
/// Zuschläge nach der Marge, Steuer. Auf **Projektebene** wird die Marge
/// nicht auf die Gesamtkosten angewandt — dort trägt die einmalige
/// Handlungspauschale eine eigene Margeposition (Referenzverhalten).
fn apply_margin_and_tax(
    input: &CalculationInput,
    mut positions: Vec<CostPosition>,
    file_id: Option<Uuid>,
) -> Result<ScopeTotals, crate::calc::CalcError> {
    let profile = &input.profile;
    let is_project_level = file_id.is_none();
    let mut running_total = sum_of(&positions);

    // --- Zuschläge vor der Marge: prozentsatz × kosten_sofar ----------------
    for surcharge in input
        .custom_surcharges
        .iter()
        .filter(|s| s.timing == SurchargeTiming::BeforeMargin)
    {
        let amount = margin::percentage_surcharge(running_total, surcharge.percent);
        let mut position = surcharge_position(surcharge, amount);
        position.file_id = file_id;
        push(&mut positions, position);
        running_total += amount;
    }

    // Die Kostenbasis endet hier — Zuschläge nach der Marge gehören nicht dazu.
    let base = running_total;

    // --- Marge: (kosten_basis − ausgeschlossene_posten) × marge_prozent ----
    let excluded = positions
        .iter()
        .filter(|position| position.excluded_from_margin)
        .map(|position| position.amount)
        .sum::<Decimal>();
    let margin_base = running_total - excluded;

    let margin_amount = if is_project_level {
        // Auf Projektebene wirkt die Marge nur auf die einmalige
        // Handlungspauschale (Referenzverhalten) — nicht auf Arbeitsschritte
        // oder projekteigene Zusatzartikel.
        let fee = positions
            .iter()
            .find(|position| position.group == CostGroup::HandlingFee)
            .map(|position| position.amount)
            .unwrap_or(Decimal::ZERO);
        margin::margin(fee, Decimal::ZERO, profile.margin_percent)
    } else {
        margin::margin(running_total, excluded, profile.margin_percent)
    };

    if !margin_amount.is_zero() {
        let margin_detail_base = if is_project_level {
            positions
                .iter()
                .find(|position| position.group == CostGroup::HandlingFee)
                .map(|position| position.amount)
                .unwrap_or(Decimal::ZERO)
        } else {
            margin_base
        };
        let mut position = CostPosition::new(CostGroup::Margin, "Gewinnmarge", margin_amount);
        position.detail = Some(format!(
            "{} % auf {} €",
            money::format_de(profile.margin_percent, 2),
            money::format_de(margin_detail_base, 2)
        ));
        position.quantity = Some(profile.margin_percent);
        position.unit = Some("%".to_string());
        position.file_id = file_id;
        positions.push(position);
    }
    running_total += margin_amount;

    // --- Zuschläge nach der Marge: prozentsatz × kosten_nach_marge ---------
    for surcharge in input
        .custom_surcharges
        .iter()
        .filter(|s| s.timing == SurchargeTiming::AfterMargin)
    {
        let amount = margin::percentage_surcharge(running_total, surcharge.percent);
        let mut position = surcharge_position(surcharge, amount);
        position.file_id = file_id;
        push(&mut positions, position);
        running_total += amount;
    }

    // --- Steuer: (kosten_nach_marge + custom_nach_marge) × steuersatz ------
    let tax_amount = margin::tax(running_total, profile.tax_rate_percent);
    if !tax_amount.is_zero() {
        let mut position = CostPosition::new(CostGroup::Tax, "Steuer", tax_amount);
        position.detail = Some(format!(
            "{} % auf {} €",
            money::format_de(profile.tax_rate_percent, 2),
            money::format_de(running_total, 2)
        ));
        position.quantity = Some(profile.tax_rate_percent);
        position.unit = Some("%".to_string());
        position.file_id = file_id;
        positions.push(position);
    }

    Ok(ScopeTotals {
        positions,
        base,
        margin: margin_amount,
        tax: tax_amount,
        total: running_total + tax_amount,
    })
}

/// Zwischenstand eines Materials innerhalb einer Datei.
struct MaterialEntry {
    name: String,
    material_id: Uuid,
    g_base: Decimal,
    g_fail: Decimal,
    cost_base: Decimal,
    cost_fail: Decimal,
    price_per_gram: Decimal,
}

/// Baut die Materialpositionen einer Datei.
///
/// Bei `combine` werden mehrere Materialien zu **einer** Position
/// zusammengefasst; sonst erhält jedes Material eine eigene Position
/// (Spec 0001, Abschnitt 4.2).
fn build_material_positions(
    entries: &[MaterialEntry],
    combine: bool,
    excluded_from_margin: bool,
    file_id: Option<Uuid>,
) -> Vec<CostPosition> {
    let mut positions = Vec::new();
    if entries.is_empty() {
        return positions;
    }

    if combine {
        let names = entries
            .iter()
            .map(|entry| entry.name.clone())
            .collect::<Vec<_>>()
            .join(" + ");
        let g_base = entries.iter().map(|entry| entry.g_base).sum::<Decimal>();
        let g_fail = entries.iter().map(|entry| entry.g_fail).sum::<Decimal>();
        let cost_base = entries.iter().map(|entry| entry.cost_base).sum::<Decimal>();
        let cost_fail = entries.iter().map(|entry| entry.cost_fail).sum::<Decimal>();

        let mut position = CostPosition::new(CostGroup::Material, names, cost_base);
        position.detail = Some(format!("{} g Material", money::format_de(g_base, 2)));
        position.quantity = Some(g_base);
        position.unit = Some("g".to_string());
        position.file_id = file_id;
        position.excluded_from_margin = excluded_from_margin;
        positions.push(position);

        let mut fail_position = CostPosition::new(
            CostGroup::Material,
            "Materialkosten (Fehlerrate)",
            cost_fail,
        );
        fail_position.detail = Some(format!("{} g Material", money::format_de(g_fail, 2)));
        fail_position.quantity = Some(g_fail);
        fail_position.unit = Some("g".to_string());
        fail_position.file_id = file_id;
        fail_position.is_fail_rate = true;
        fail_position.excluded_from_margin = excluded_from_margin;
        positions.push(fail_position);
        return positions;
    }

    for entry in entries {
        let mut position =
            CostPosition::new(CostGroup::Material, entry.name.clone(), entry.cost_base);
        position.detail = Some(format!(
            "{} g × {} €/g",
            money::format_de(entry.g_base, 2),
            money::format_de(entry.price_per_gram, 6)
        ));
        position.quantity = Some(entry.g_base);
        position.unit = Some("g".to_string());
        position.file_id = file_id;
        position.source_id = Some(entry.material_id);
        position.excluded_from_margin = excluded_from_margin;
        positions.push(position);

        let mut fail_position = CostPosition::new(
            CostGroup::Material,
            "Materialkosten (Fehlerrate)",
            entry.cost_fail,
        );
        fail_position.detail = Some(format!("{} g Verbrauch", money::format_de(entry.g_fail, 2)));
        fail_position.quantity = Some(entry.g_fail);
        fail_position.unit = Some("g".to_string());
        fail_position.file_id = file_id;
        fail_position.source_id = Some(entry.material_id);
        fail_position.is_fail_rate = true;
        fail_position.excluded_from_margin = excluded_from_margin;
        positions.push(fail_position);
    }

    positions
}

/// Baut die Position eines prozentualen Zuschlags.
fn surcharge_position(surcharge: &CustomSurcharge, amount: Decimal) -> CostPosition {
    let mut position =
        CostPosition::new(CostGroup::CustomSurcharge, surcharge.name.clone(), amount);
    position.detail = Some(format!("{} %", money::format_de(surcharge.percent, 2)));
    position.quantity = Some(surcharge.percent);
    position.unit = Some("%".to_string());
    position.source_id = Some(surcharge.id);
    position
}

/// Summiert alle Beträge einer Positionsliste.
fn sum_of(positions: &[CostPosition]) -> Decimal {
    positions.iter().map(|position| position.amount).sum()
}

/// Hängt eine Position an, sofern ihr Betrag ungleich null ist.
///
/// Positionen mit dem Betrag 0 würden im Ergebnis nur Rauschen erzeugen —
/// Beispiel: `stückzahl = 0` erzeugt keine Material- und Maschinenpositionen,
/// `fehlerrate = 0` erzeugt keine Fehlerraten-Positionen, `marge = 0` erzeugt
/// keine Margenposition (Spec 0003, Randfälle).
fn push(positions: &mut Vec<CostPosition>, position: CostPosition) {
    if position.amount.is_zero() {
        return;
    }
    positions.push(position);
}
