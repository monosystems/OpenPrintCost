import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalculationFileInput, CalculationResult } from "../api/types";
import { LanguageProvider } from "../i18n";
import { CalculationResultView } from "../components/CalculationResultView";
import fixture from "./fixtures/core-calculation.json";

describe("core fixture contract", () => {
  it("renders a result produced by the real Rust calculation engine", () => {
    const result = fixture.result as unknown as CalculationResult;
    const files = fixture.input.files as unknown as CalculationFileInput[];

    render(
      <LanguageProvider initial="en">
        <CalculationResultView result={result} files={files} currency="$" />
      </LanguageProvider>,
    );

    expect(screen.getByText(/Fixture Calculation/)).toBeInTheDocument();
    expect(screen.getAllByText("Machine costs").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Selling price").length).toBeGreaterThan(0);
  });
});
