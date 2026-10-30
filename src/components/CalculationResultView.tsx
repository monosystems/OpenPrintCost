import { formatMoney, sumSignedDecimalStrings } from "../api/format";
import { localizeDetail } from "../api/currency";
import { useLocale } from "../i18n";
import { localizePositionLabel } from "../i18n/positionLabels";
import type {
  CalculationFileInput,
  CalculationResult,
  CostPosition,
} from "../api/types";
import { GROUP_ORDER, groupLabels } from "./costGroups";
import { SecondaryButton } from "./ui";

function fileNameOf(position: CostPosition, files: CalculationFileInput[]): string | null {
  if (!position.file_id) return null;
  return files.find((file) => file.id === position.file_id)?.file_name ?? null;
}

export function CalculationResultView({
  result,
  files,
  currency = "$",
  onExportPdf,
  onExportExcel,
  exporting = null,
}: {
  result: CalculationResult;
  files: CalculationFileInput[];
  /** Anzeige-Symbol (reine Darstellung, keine Umrechnung). */
  currency?: string;
  onExportPdf?: () => void;
  onExportExcel?: () => void;
  exporting?: "pdf" | "xlsx" | null;
}) {
  const { t, locale } = useLocale();
  const labels = groupLabels(t);
  const groups = GROUP_ORDER.filter((group) =>
    result.positions.some((position) => position.group === group),
  );

  return (
    <section aria-label={t.calculation.resultTitle} className="mt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-ink">
          {t.calculation.resultTitle}: {result.project_name}
        </h3>
        {onExportPdf || onExportExcel ? (
          <div className="flex flex-wrap gap-2">
            {onExportPdf ? (
              <SecondaryButton
                type="button"
                onClick={onExportPdf}
                loading={exporting === "pdf"}
                disabled={exporting !== null}
              >
                {exporting === "pdf" ? t.calculation.exporting : t.calculation.exportPdf}
              </SecondaryButton>
            ) : null}
            {onExportExcel ? (
              <SecondaryButton
                type="button"
                onClick={onExportExcel}
                loading={exporting === "xlsx"}
                disabled={exporting !== null}
              >
                {exporting === "xlsx" ? t.calculation.exporting : t.calculation.exportExcel}
              </SecondaryButton>
            ) : null}
          </div>
        ) : null}
      </div>

      {groups.map((group) => {
        const positions = result.positions.filter((position) => position.group === group);
        const subtotal =
          sumSignedDecimalStrings(positions.map((position) => position.amount)) ?? "0";
        const isTotal = group === "total";
        return (
          <div key={group} className="mb-4 overflow-hidden rounded-card border border-line">
            <div
              className={`flex items-center justify-between px-4 py-2.5 ${
                isTotal ? "bg-brand-soft" : "bg-surface"
              }`}
            >
              <h4
                className={`text-sm font-semibold ${
                  isTotal ? "text-brand-ink" : "text-ink"
                }`}
              >
                {labels[group]}
              </h4>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  isTotal ? "text-accent" : "text-ink"
                }`}
              >
                {formatMoney(subtotal, locale)} {currency}
              </span>
            </div>
            {!isTotal ? (
              <ul className="divide-y divide-line bg-canvas">
                {positions.map((position) => {
                  const file = fileNameOf(position, files);
                  return (
                    <li key={position.id} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-ink">
                          {localizePositionLabel(position.label, t)}
                          {position.is_fail_rate ? (
                            <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                              {t.calculation.failRateBadge}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-ink-faint">
                          {[position.detail ? localizeDetail(position.detail, currency, locale) : null, file ? `${t.calculation.resultFilePrefix}: ${file}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-ink">
                        {formatMoney(position.amount, locale)} {currency}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}

      <dl className="grid grid-cols-2 gap-4 rounded-card border border-line bg-surface p-4 text-sm md:grid-cols-3 xl:grid-cols-6">
        <div>
          <dt className="text-xs text-ink-faint">{t.calculation.sums.base}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {formatMoney(result.base_total, locale)} {currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">{t.calculation.sums.margin}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {formatMoney(result.margin_total, locale)} {currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">{t.calculation.sums.tax}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {formatMoney(result.tax_total, locale)} {currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">{t.calculation.sums.total}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-accent">
            {formatMoney(result.total, locale)} {currency}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">{t.calculation.sums.costPerPiece}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-ink">
            {result.cost_per_piece
              ? `${formatMoney(result.cost_per_piece, locale)} ${currency}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-faint">{t.calculation.sums.pricePerPiece}</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-accent">
            {result.price_per_piece
              ? `${formatMoney(result.price_per_piece, locale)} ${currency}`
              : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
