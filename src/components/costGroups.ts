import type { CostGroup } from "../api/types";
import type { Strings } from "../i18n";

/** Display order of the cost groups the engine returns. */
export const GROUP_ORDER: CostGroup[] = [
  "material",
  "machine",
  "energy",
  "process-surcharge",
  "worksteps",
  "additional-items",
  "handling-fee",
  "custom-surcharge",
  "margin",
  "tax",
  "total",
];

export function groupLabels(t: Strings): Record<CostGroup, string> {
  return {
    material: t.resultGroups.material,
    machine: t.resultGroups.machine,
    energy: t.resultGroups.energy,
    "process-surcharge": t.resultGroups.processSurcharge,
    worksteps: t.resultGroups.worksteps,
    "additional-items": t.resultGroups.additionalItems,
    "handling-fee": t.resultGroups.handlingFee,
    "custom-surcharge": t.resultGroups.customSurcharge,
    margin: t.resultGroups.margin,
    tax: t.resultGroups.tax,
    total: t.resultGroups.total,
  };
}
