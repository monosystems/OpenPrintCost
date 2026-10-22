import { formatMoney } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import type {
  CalculationFileInput,
  CalculationResult,
  CostGroup,
  CostPosition,
} from "../api/types";

const GROUP_ORDER: CostGroup[] = [
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

function groupLabels(t: Strings): Record<CostGroup, string> {
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

function fileNameOf(position: CostPosition, files: CalculationFileInput[]): string | null {
  if (!position.file_id) return null;
  return files.find((file) => file.id === position.file_id)?.file_name ?? null;
}

export function CalculationResultView({
  result,
  files,
}: {
  result: CalculationResult;
  files: CalculationFileInput[];
}) {
  const { t, locale } = useLocale();
  const labels = groupLabels(t);
  const groups = GROUP_ORDER.filter((group) =>
    result.positions.some((position) => position.group === group),
  );

  return (
    <section aria-label={t.calculation.resultTitle} className="mt-8">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">
        {t.calculation.resultTitle}: {result.project_name}
      </h3>

      {groups.map((group) => {
        const positions = result.positions.filter((position) => position.group === group);
        const subtotal = positions
          .map((position) => position.amount)
          .reduce((sum, amount) => sum + Number(amount), 0);
        const isTotal = group === "total";
        return (
          <div key={group} className="mb-4 overflow-hidden rounded-lg border border-slate-800">
            <div
              className={`flex items-center justify-between px-4 py-2 ${
                isTotal ? "bg-sky-950" : "bg-slate-900"
              }`}
            >
              <h4 className={`text-sm font-semibold ${isTotal ? "text-sky-300" : "text-slate-200"}`}>
                {labels[group]}
              </h4>
              <span className={`text-sm font-semibold ${isTotal ? "text-sky-300" : "text-slate-200"}`}>
                {formatMoney(subtotal.toFixed(2), locale)} €
              </span>
            </div>
            {!isTotal ? (
              <ul className="divide-y divide-slate-800 bg-slate-950">
                {positions.map((position) => {
                  const file = fileNameOf(position, files);
                  return (
                    <li key={position.id} className="flex items-baseline justify-between gap-4 px-4 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-200">
                          {position.label}
                          {position.is_fail_rate ? (
                            <span className="ml-2 rounded bg-amber-950 px-1.5 py-0.5 text-xs text-amber-300">
                              {t.calculation.failRateBadge}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {[position.detail, file ? `${t.calculation.resultFilePrefix}: ${file}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-slate-100">
                        {formatMoney(position.amount, locale)} €
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}

      <dl className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-900 p-4 text-sm md:grid-cols-4">
        <div>
          <dt className="text-xs text-slate-500">{t.calculation.sums.base}</dt>
          <dd className="font-semibold text-slate-100">{formatMoney(result.base_total, locale)} €</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t.calculation.sums.margin}</dt>
          <dd className="font-semibold text-slate-100">{formatMoney(result.margin_total, locale)} €</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t.calculation.sums.tax}</dt>
          <dd className="font-semibold text-slate-100">{formatMoney(result.tax_total, locale)} €</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">{t.calculation.sums.total}</dt>
          <dd className="font-semibold text-sky-400">{formatMoney(result.total, locale)} €</dd>
        </div>
      </dl>
    </section>
  );
}
