import { useEffect, useId, useRef, useState } from "react";
import {
  groupPresetsByManufacturer,
  type PrinterPreset,
} from "../data/printerPresets";

interface PresetTreeSelectProps {
  presets?: ReadonlyArray<PrinterPreset>;
  placeholder: string;
  onPick: (key: string) => void;
}

/**
 * Baum-Dropdown: Hersteller als aufklappbare Knoten, Modelle als Blätter.
 * Sortierung (Hersteller + Modell A–Z) kommt aus groupPresetsByManufacturer.
 */
export function PresetTreeSelect({ presets, placeholder, onPick }: PresetTreeSelectProps) {
  const groups = groupPresetsByManufacturer(presets);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(groups.map((group) => group.manufacturer)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const toggleGroup = (manufacturer: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(manufacturer)) next.delete(manufacturer);
      else next.add(manufacturer);
      return next;
    });
  };

  const pick = (key: string) => {
    onPick(key);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-control border border-line-strong bg-field px-3 text-sm text-ink transition-colors hover:border-ink-faint hover:bg-field-hover focus:border-brand"
      >
        <span className="truncate text-ink-muted">{placeholder}</span>
        <span aria-hidden="true" className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open ? (
        <div
          id={listId}
          aria-labelledby={buttonId}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-control border border-line-strong bg-raised py-1 shadow-lg"
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink-muted hover:bg-field-hover"
          >
            <span aria-hidden="true" className="w-4 shrink-0" />
            <span className="truncate">{placeholder}</span>
          </button>

          <ul>
          {groups.map((group) => {
            const isExpanded = expanded.has(group.manufacturer);
            return (
              <li key={group.manufacturer}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={() => toggleGroup(group.manufacturer)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-ink hover:bg-field-hover"
                >
                  <span aria-hidden="true" className="w-4 shrink-0 text-ink-faint">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                  <span className="truncate">{group.manufacturer}</span>
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-ink-faint">
                    {group.presets.length}
                  </span>
                </button>

                {isExpanded ? (
                  <ul>
                    {group.presets.map((preset) => (
                      <li key={preset.key}>
                        <button
                          type="button"
                          onClick={() => pick(preset.key)}
                          className="flex w-full items-center gap-2 py-1.5 pl-9 pr-3 text-left text-sm text-ink hover:bg-field-hover"
                        >
                          <span className="truncate">{preset.model}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
