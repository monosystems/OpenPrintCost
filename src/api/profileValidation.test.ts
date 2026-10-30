import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { profileDecimalError, validateProfileDecimals } from "./profileValidation";
import type { CalculationProfile } from "./types";

const profile: CalculationProfile = {
  id: "22222222-2222-2222-2222-222222222222",
  name: "Test",
  fail_rate_percent: "110",
  tax_rate_percent: "19",
  margin_percent: "-5",
  handling_fee: "-1",
  handling_fee_scope: "once",
  energy_price_per_kwh: "0.35",
  apply_energy_costs: true,
  power_level_percent: "100",
  combine_materials: false,
  multiply_print_time_with_quantity: true,
  print_time_factor: "1",
  exclude_machine_from_margin: false,
  exclude_material_from_margin: false,
  exclude_worksteps_from_margin: false,
};

describe("profileDecimalError", () => {
  it("uses the same percent and non-negative rules as the editor", () => {
    expect(profileDecimalError("fail_rate_percent", "110", en)).toBe(
      en.validation.percent(en.profiles.failRate),
    );
    expect(profileDecimalError("handling_fee", "-1", en)).toBe(
      en.validation.nonNegative(en.profiles.handlingFee),
    );
    expect(profileDecimalError("margin_percent", "-5", en)).toBeNull();
    expect(profileDecimalError("tax_rate_percent", "19", en)).toBeNull();
  });

  it("reports every invalid decimal field", () => {
    const errors = validateProfileDecimals(profile, en);
    expect(errors.fail_rate_percent).toBe(en.validation.percent(en.profiles.failRate));
    expect(errors.handling_fee).toBe(en.validation.nonNegative(en.profiles.handlingFee));
    expect(errors.tax_rate_percent).toBeUndefined();
  });
});
