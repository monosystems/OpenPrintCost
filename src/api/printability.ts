import type { DimensionsMm, Printer } from "./types";

export type PrintAxis = "x" | "y" | "z";

export interface Printability {
  fits: boolean;
  axes: PrintAxis[];
  /** Largest axis ratio, in percent of the corresponding build axis. */
  utilizationPercent: number;
}

type BuildVolume = Pick<
  Printer,
  "build_width_mm" | "build_depth_mm" | "build_height_mm"
>;

const AXES: PrintAxis[] = ["x", "y", "z"];

/**
 * Compares part dimensions with the printer's build volume.
 *
 * Returns `null` when either side is unknown (missing dimensions or a build
 * axis of 0), because then no reliable statement is possible. This mirrors
 * the core rule in `opc-core::calc::fit`.
 */
export function checkPrintability(
  dimensions: DimensionsMm | null | undefined,
  printer: BuildVolume,
): Printability | null {
  if (!dimensions) return null;

  const part = dimensions.map(Number);
  const build = [
    Number(printer.build_width_mm),
    Number(printer.build_depth_mm),
    Number(printer.build_height_mm),
  ];

  if (
    !part.every((value) => Number.isFinite(value) && value > 0) ||
    !build.every((value) => Number.isFinite(value) && value > 0)
  ) {
    return null;
  }

  const axes = AXES.filter((_, index) => part[index]! > build[index]!);
  const utilizationPercent = Math.max(
    ...part.map((value, index) => (value / build[index]!) * 100),
  );

  return { fits: axes.length === 0, axes, utilizationPercent };
}
