import { useState, type ReactNode } from "react";
import { useStrings } from "../i18n";
import { ChevronDownIcon, SearchIcon, XIcon } from "./icons";

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Enables sorting and defines the value used for comparison. */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
  className?: string;
}

/**
 * Compact master-data table with client-side search and sorting.
 *
 * The search stays local to the table; the owning view only renders it when
 * there is at least one row, so an empty dataset keeps its guided empty state.
 */
export function DataTable<T>({
  label,
  rows,
  columns,
  rowKey,
  searchText,
}: {
  label: string;
  rows: T[];
  columns: ReadonlyArray<DataColumn<T>>;
  rowKey: (row: T) => string;
  searchText: (row: T) => string;
}) {
  const t = useStrings();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);

  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? rows.filter((row) => searchText(row).toLowerCase().includes(normalized))
    : rows;

  const sorted = sort
    ? [...filtered].sort((left, right) => {
        const column = columns.find((entry) => entry.key === sort.key);
        if (!column?.sortValue) return 0;
        const a = column.sortValue(left);
        const b = column.sortValue(right);
        const result =
          typeof a === "number" && typeof b === "number"
            ? a - b
            : String(a).localeCompare(String(b), undefined, { numeric: true });
        return sort.direction === "asc" ? result : -result;
      })
    : filtered;

  const toggleSort = (column: DataColumn<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.key === column.key
        ? {
            key: column.key,
            direction: current.direction === "asc" ? "desc" : "asc",
          }
        : { key: column.key, direction: "asc" },
    );
  };

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">{t.common.search}</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.common.searchPlaceholder}
            aria-label={t.common.search}
            className="h-9 w-full rounded-control border border-line-strong bg-canvas pl-9 pr-9 text-sm text-ink placeholder:text-ink-faint transition-colors [&::-webkit-search-cancel-button]:hidden hover:border-ink-faint focus:border-brand"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.common.clearSearch}
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-ink-faint hover:bg-raised hover:text-ink"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <p className="text-xs text-ink-faint">{t.common.entries(filtered.length)}</p>
      </div>

      <div className="overflow-x-auto">
        <table aria-label={label} className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => {
                const isSorted = sort?.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      column.sortValue
                        ? isSorted
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint ${
                      column.align === "right" ? "text-right" : "text-left"
                    } ${column.className ?? ""}`}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] text-ink-faint hover:text-ink"
                      >
                        {column.header}
                        <ChevronDownIcon
                          className={`h-3 w-3 transition-transform ${
                            isSorted ? "opacity-100" : "opacity-30"
                          } ${isSorted && sort.direction === "asc" ? "rotate-180" : ""}`}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-ink-muted">
                  <p>{t.common.noMatches}</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-2 text-brand-ink hover:underline"
                  >
                    {t.common.clearSearch}
                  </button>
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-line transition-colors last:border-b-0 hover:bg-raised/40"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 align-middle ${
                        column.align === "right" ? "text-right tabular-nums" : "text-left"
                      } ${column.className ?? ""}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
