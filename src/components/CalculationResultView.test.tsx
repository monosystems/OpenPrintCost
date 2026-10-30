import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { newId, type CalculationResult } from "../api/types";
import { LanguageProvider } from "../i18n";
import { CalculationResultView } from "./CalculationResultView";

function result(): CalculationResult {
  return {
    id: newId(),
    project_name: "Test",
    created_at: null,
    notes: null,
    positions: [
      {
        id: newId(),
        group: "machine",
        label: "Maschinenkosten",
        detail: "2,00 h × 25,00 €/h",
        quantity: "2",
        unit: "h",
        amount: "50",
        file_id: null,
        source_id: null,
        is_fail_rate: false,
        excluded_from_margin: false,
      },
      {
        id: newId(),
        group: "total",
        label: "Verkaufspreis",
        detail: "50,00 €",
        quantity: null,
        unit: null,
        amount: "50",
        file_id: null,
        source_id: null,
        is_fail_rate: false,
        excluded_from_margin: false,
      },
    ],
    base_total: "50",
    margin_total: "0",
    tax_total: "0",
    total: "50",
    machine_hour_rate: "25",
    total_quantity: 1,
    cost_per_piece: "50",
    price_per_piece: "50",
    files: [],
  };
}

describe("CalculationResultView", () => {
  it("localizes core position labels and details", () => {
    render(
      <LanguageProvider initial="en">
        <CalculationResultView result={result()} files={[]} currency="$" />
      </LanguageProvider>,
    );

    expect(screen.getAllByText("Machine costs").length).toBeGreaterThan(0);
    expect(screen.getByText(/2\.00 h × 25\.00 \$\/h/)).toBeInTheDocument();
    expect(screen.queryByText("Maschinenkosten")).not.toBeInTheDocument();
  });
});
