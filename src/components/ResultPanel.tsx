import { formatMoney, sumSignedDecimalStrings } from "../api/format";
import { useLocale } from "../i18n";
import type { CalculationResult, CostGroup } from "../api/types";
import { GROUP_ORDER, groupLabels } from "./costGroups";
import { ArrowRightIcon } from "./icons";
import { PrimaryButton, SecondaryButton } from "./ui";

interface SummaryActions {
  calculating: boolean;
  saving: boolean;
  onCalculate: () => void;
  onSave: () => void;
}

type BreakdownGroup = CostGroup | "other";

const BAR_COLORS: Record<BreakdownGroup, string> = {
  material: "bg-brand",
  machine: "bg-brand-ink",
  energy: "bg-warning",
  "process-surcharge": "bg-warning/70",
  worksteps: "bg-accent",
  "additional-items": "bg-accent/70",
  "handling-fee": "bg-ink-muted",
  "custom-surcharge": "bg-ink-muted/70",
  margin: "bg-ink-faint",
  tax: "bg-line-strong",
  total: "bg-transparent",
  other: "bg-ink-faint",
};

/** Sticky summary column for the wide calculation workspace. */
export function ResultPanel({
  result,
  currency = "$",
  onShowDetails,
  ...actions
}: {
  result: CalculationResult | null;
  /** Anzeige-Symbol (reine Darstellung, keine Umrechnung). */
  currency?: string;
  onShowDetails?: () => void;
} & SummaryActions) {
  const { t, locale } = useLocale();

  return (
    <aside aria-label={t.calculation.summary} className="space-y-3">
      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {result ? t.calculation.totalLabel : t.calculation.notCalculated}
        </p>
        <p
          className={`mt-1 text-3xl font-semibold tabular-nums ${
            result ? "text-accent" : "text-ink-faint"
          }`}
          aria-live="polite"
        >
          {result ? `${formatMoney(result.total, locale)} ${currency}` : "—"}
        </p>
        <p className="mt-2 min-h-5 truncate text-xs text-ink-faint">
          {result ? result.project_name : t.calculation.notCalculatedHint}
        </p>

        {result ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                {t.calculation.baseLabel}
              </dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
                {formatMoney(result.base_total, locale)} {currency}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
                {t.calculation.pricePerPiece}
              </dt>
              <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
                {result.price_per_piece
                  ? `${formatMoney(result.price_per_piece, locale)} ${currency}`
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        <div className="mt-5 space-y-2">
          <PrimaryButton
            type="button"
            className="w-full"
            onClick={actions.onCalculate}
            loading={actions.calculating}
          >
            {actions.calculating ? t.calculation.calculating : t.calculation.calculate}
          </PrimaryButton>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton
              type="button"
              onClick={actions.onSave}
              loading={actions.saving}
            >
              {actions.saving ? t.calculation.saving : t.calculation.save}
            </SecondaryButton>
            <SecondaryButton
              type="button"
              onClick={onShowDetails}
              disabled={!result}
            >
              {t.calculation.details}
              <ArrowRightIcon />
            </SecondaryButton>
          </div>
        </div>
      </div>

      {result ? <CostBreakdown result={result} currency={currency} /> : null}
    </aside>
  );
}

/** Compact sticky bar for widths below the two-column breakpoint. */
export function CompactSummary({
  result,
  currency = "$",
  ...actions
}: {
  result: CalculationResult | null;
  /** Anzeige-Symbol (reine Darstellung, keine Umrechnung). */
  currency?: string;
} & SummaryActions) {
  const { t, locale } = useLocale();

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-line bg-canvas/95 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {result ? t.calculation.totalLabel : t.calculation.notCalculated}
          </p>
          <p className="truncate text-lg font-semibold tabular-nums text-accent" aria-live="polite">
            {result ? `${formatMoney(result.total, locale)} ${currency}` : "—"}
          </p>
          {result?.price_per_piece ? (
            <p className="truncate text-[11px] tabular-nums text-ink-faint">
              {t.calculation.pricePerPiece}: {formatMoney(result.price_per_piece, locale)} {currency}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            type="button"
            onClick={actions.onSave}
            loading={actions.saving}
          >
            {actions.saving ? t.calculation.saving : t.calculation.save}
          </SecondaryButton>
          <PrimaryButton
            type="button"
            onClick={actions.onCalculate}
            loading={actions.calculating}
          >
            {actions.calculating ? t.calculation.calculating : t.calculation.calculate}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact cost composition for the summary column.
 *
 * Shows the four largest groups plus an aggregated "other" bucket. Values
 * come from the engine positions; only the grouping and percentage display
 * happen here.
 */
function CostBreakdown({ result, currency = "$" }: { result: CalculationResult; currency?: string }) {
  const { t, locale } = useLocale();
  const labels = groupLabels(t);
  const total = Number(result.total);

  const rows = GROUP_ORDER.filter(
    (group) => group !== "total" && result.positions.some((position) => position.group === group),
  )
    .map((group) => ({
      group: group as BreakdownGroup,
      amount:
        sumSignedDecimalStrings(
          result.positions
            .filter((position) => position.group === group)
            .map((position) => position.amount),
        ) ?? "0",
    }))
    .filter((row) => Number(row.amount) !== 0)
    .sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));

  const visible = rows.slice(0, 4);
  const rest = rows.slice(4);
  if (rest.length > 0) {
    visible.push({
      group: "other",
      amount: sumSignedDecimalStrings(rest.map((row) => row.amount)) ?? "0",
    });
  }

  if (visible.length === 0) return null;

  return (
    <section className="rounded-card border border-line bg-surface p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {t.calculation.costBreakdown}
      </h3>
      <div className="mt-3 space-y-3">
        {visible.map((row) => {
          const label = row.group === "other" ? t.resultGroups.other : labels[row.group];
          const amount = Number(row.amount);
          const share = total > 0 ? Math.min(100, Math.max(0, (amount / total) * 100)) : 0;
          return (
            <div key={row.group}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${BAR_COLORS[row.group]}`}
                  />
                  <span className="truncate">{label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-ink">
                  {formatMoney(row.amount, locale)} {currency}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[row.group]}`}
                  style={{ width: `${share}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
