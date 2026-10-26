import { describe, expect, it } from "vitest";
import { checkPrintability } from "./printability";

const printer = {
  build_width_mm: "250",
  build_depth_mm: "210",
  build_height_mm: "220",
};

describe("checkPrintability", () => {
  it("accepts a part that fits and reports utilization", () => {
    const result = checkPrintability(["125", "105", "110"], printer);
    expect(result).toEqual({ fits: true, axes: [], utilizationPercent: 50 });
  });

  it("reports every exceeded axis", () => {
    const result = checkPrintability(["251", "100", "221"], printer);
    expect(result?.fits).toBe(false);
    expect(result?.axes).toEqual(["x", "z"]);
    expect(result?.utilizationPercent).toBeCloseTo(100.45);
  });

  it("returns null without dimensions or a complete build volume", () => {
    expect(checkPrintability(null, printer)).toBeNull();
    expect(checkPrintability(["100", "100", "100"], { ...printer, build_height_mm: "0" })).toBeNull();
    expect(checkPrintability(["100", "0", "100"], printer)).toBeNull();
  });
});
