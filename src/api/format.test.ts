import { describe, expect, it } from "vitest";
import {
  divideDecimalString,
  isDecimalString,
  multiplyDecimalStrings,
  sumDecimalStrings,
  sumSignedDecimalStrings,
} from "./format";

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

describe("isDecimalString", () => {
  it("accepts values representable by rust_decimal", () => {
    expect(isDecimalString("1.23")).toBe(true);
    expect(isDecimalString("-0.5")).toBe(true);
    expect(isDecimalString("79228162514264337593543950335")).toBe(true);
    expect(isDecimalString("7.9228162514264337593543950335")).toBe(true);
    expect(isDecimalString(`0.${"1".repeat(28)}`)).toBe(true);
  });

  it("rejects values outside the rust_decimal range", () => {
    expect(isDecimalString("79228162514264337593543950336")).toBe(false);
    expect(isDecimalString("1".repeat(30))).toBe(false);
    expect(isDecimalString(`0.${"1".repeat(29)}`)).toBe(false);
    expect(isDecimalString(`9.${"9".repeat(28)}`)).toBe(false);
  });

  it("still rejects malformed numbers", () => {
    expect(isDecimalString("")).toBe(false);
    expect(isDecimalString("1,5")).toBe(false);
    expect(isDecimalString("1e3")).toBe(false);
    expect(isDecimalString(".")).toBe(false);
  });
});

describe("divideDecimalString", () => {
  it("divides and rounds half-up", () => {
    expect(divideDecimalString("10", 2)).toBe("5");
    expect(divideDecimalString("10", 3, 3)).toBe("3.333");
    expect(divideDecimalString("1.005", 1, 2)).toBe("1.01");
    expect(divideDecimalString("3.6075", 2)).toBe("1.80375");
  });

  it("rejects invalid input", () => {
    expect(divideDecimalString("-1", 2)).toBeNull();
    expect(divideDecimalString("1", 0)).toBeNull();
    expect(divideDecimalString("1,5", 2)).toBeNull();
  });
});
