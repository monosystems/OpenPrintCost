import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_LABELS, useLocale } from "../i18n";
import { ChevronDownIcon, GlobeIcon } from "./icons";

/**
 * Language switcher: a single button that opens a list of locales.
 *
 * Kept as a dropdown (not a row of buttons) so that adding more languages
 * does not widen the header. Keyboard support: Escape closes and returns
 * focus to the trigger, clicking outside closes.
 */
export function LanguageSwitcher({
  placement = "down",
  align = "end",
}: {
  placement?: "down" | "up";
  align?: "start" | "end";
}) {
  const { t, locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }, [open]);

  const choose = (next: (typeof LOCALES)[number]) => {
    setLocale(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t.app.language}
        className="flex h-9 items-center gap-1.5 rounded-control border border-line-strong bg-raised px-3 text-sm text-ink transition-colors hover:bg-raised-hover"
      >
        <GlobeIcon className="h-4 w-4 text-ink-muted" />
        {LOCALE_LABELS[locale]}
        <ChevronDownIcon className="h-3.5 w-3.5 text-ink-muted" />
      </button>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t.app.language}
          className={`absolute z-50 w-44 overflow-hidden rounded-card border border-line-strong bg-raised py-1 shadow-2xl ${
            align === "start" ? "left-0" : "right-0"
          } ${placement === "up" ? "bottom-full mb-2" : "mt-2"}`}
        >
          {LOCALES.map((code) => (
            <li key={code} role="none">
              <button
                type="button"
                role="option"
                aria-selected={locale === code}
                onClick={() => choose(code)}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors ${
                  locale === code
                    ? "bg-brand-soft text-brand-ink"
                    : "text-ink hover:bg-raised-hover"
                }`}
              >
                {LOCALE_LABELS[code]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
