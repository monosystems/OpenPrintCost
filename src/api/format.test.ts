import { describe, expect, it } from "vitest";
import { multiplyDecimalStrings } from "./format";

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
