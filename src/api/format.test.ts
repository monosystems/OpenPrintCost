import { describe, expect, it } from "vitest";
import { multiplyDecimalStrings, sumDecimalStrings, sumSignedDecimalStrings } from "./format";

describe("multiplyDecimalStrings", () => {
  it("multiplies whole numbers exactly", () => {
    expect(multiplyDecimalStrings(["250", "210", "220"])).toBe("11550000");
  });

  it("keeps decimal places exact", () => {
    expect(multiplyDecimalStrings(["0.1", "0.2", "0.3"])).toBe("0.006");
    expect(multiplyDecimalStrings(["2.50", "4"])).toBe("10");
  });

  it("rejects values that are not plain decimal numbers", () => {
    expect(multiplyDecimalStrings(["2", "-3"])).toBeNull();
    expect(multiplyDecimalStrings(["2", "3e4"])).toBeNull();
    expect(multiplyDecimalStrings(["2", ""])).toBeNull();
  });
});

describe("sumDecimalStrings", () => {
  it("sums whole and decimal values exactly", () => {
    expect(sumDecimalStrings(["2886.34", "1202.5"])).toBe("4088.84");
    expect(sumDecimalStrings(["0.1", "0.02"])).toBe("0.12");
    expect(sumDecimalStrings(["0.30000", "0.4"])).toBe("0.7");
  });

  it("returns zero for an empty list", () => {
    expect(sumDecimalStrings([])).toBe("0");
  });

  it("rejects values that are not non-negative plain decimals", () => {
    expect(sumDecimalStrings(["2", "-3"])).toBeNull();
    expect(sumDecimalStrings(["2", "3e4"])).toBeNull();
    expect(sumDecimalStrings(["2", ""])).toBeNull();
  });
});

describe("sumSignedDecimalStrings", () => {
  it("sums signed values exactly and keeps the final sign", () => {
    expect(sumSignedDecimalStrings(["0.31", "-0.05", "1.005"])).toBe("1.265");
    expect(sumSignedDecimalStrings(["-1", "0.25"])).toBe("-0.75");
    expect(sumSignedDecimalStrings(["-0.1", "0.1"])).toBe("0");
  });

  it("returns zero for an empty list", () => {
    expect(sumSignedDecimalStrings([])).toBe("0");
  });

  it("rejects values that are not plain decimals", () => {
    expect(sumSignedDecimalStrings(["2", "3e4"])).toBeNull();
    expect(sumSignedDecimalStrings(["2", ""])).toBeNull();
    expect(sumSignedDecimalStrings(["2", "1,5"])).toBeNull();
  });
});
