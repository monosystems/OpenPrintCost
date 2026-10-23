import { useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_LABELS, useLocale } from "../i18n";

/**
 * Language switcher: a single button that opens a list of locales.
 *
 * Kept as a dropdown (not a row of buttons) so that adding more languages
 * does not widen the header. Keyboard support: Escape closes and returns
 * focus to the trigger, clicking outside closes.
 */
export function LanguageSwitcher() {
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
        className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-700"
      >
        <span aria-hidden="true">🌐</span>
        {LOCALE_LABELS[locale]}
        <span aria-hidden="true" className="text-xs text-slate-400">
          ▾
        </span>
      </button>

      {open ? (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t.app.language}
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-md border border-slate-700 bg-slate-900 py-1 shadow-xl"
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
                    ? "bg-sky-950 text-sky-300"
                    : "text-slate-200 hover:bg-slate-800"
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
