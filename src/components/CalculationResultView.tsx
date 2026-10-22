import { formatMoney } from "../api/format";
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

const GROUP_LABELS: Record<CostGroup, string> = {
  material: "Material",
  machine: "Maschinenkosten",
  energy: "Energiekosten",
  "process-surcharge": "Verfahrenszuschläge",
  worksteps: "Arbeitsschritte",
  "additional-items": "Zusatzartikel",
  "handling-fee": "Handlungspauschale",
  "custom-surcharge": "Zuschläge",
  margin: "Gewinnmarge",
  tax: "Steuer",
  total: "Gesamtkosten",
};

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
  const groups = GROUP_ORDER.filter((group) =>
    result.positions.some((position) => position.group === group),
  );

  return (
    <section aria-label="Kalkulationsergebnis" className="mt-8">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">
        Ergebnis: {result.project_name}
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
                {GROUP_LABELS[group]}
              </h4>
              <span className={`text-sm font-semibold ${isTotal ? "text-sky-300" : "text-slate-200"}`}>
                {formatMoney(subtotal.toFixed(2))} €
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
                              Fehlerrate
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {[position.detail, file ? `Datei: ${file}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-slate-100">
                        {formatMoney(position.amount)} €
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
          <dt className="text-xs text-slate-500">Basis</dt>
          <dd className="font-semibold text-slate-100">{formatMoney(result.base_total)} €</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Marge</dt>
          <dd className="font-semibold text-slate-100">{formatMoney(result.margin_total)} €</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Steuer</dt>
          <dd className="font-semibold text-slate-100">{formatMoney(result.tax_total)} €</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Gesamt</dt>
          <dd className="font-semibold text-sky-400">{formatMoney(result.total)} €</dd>
        </div>
      </dl>
    </section>
  );
}
