import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { de, type Strings } from "./de";
import { en } from "./en";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

const STORAGE_KEY = "opc-locale";

/** One dictionary per registered locale — the type requires all of them. */
const dictionaries: Record<Locale, Strings> = { en, de };

/** Browser-language detection: matches the primary subtag, else the default. */
export function detectLocale(): Locale {
  const language = typeof navigator !== "undefined" ? (navigator.language ?? "").toLowerCase() : "";
  const base = language.split("-")[0];
  return LOCALES.find((code) => code === base) ?? DEFAULT_LOCALE;
}

/** Stored preference wins; anything else falls back to detection. */
export function resolveLocale(stored: string | null | undefined): Locale {
  return LOCALES.find((code) => code === stored) ?? detectLocale();
}

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Strings;
}

/**
 * Default (no provider — e.g. tests): English. The provider overrides this
 * with the stored or detected locale.
 */
const LanguageContext = createContext<LocaleState>({
  locale: "en",
  setLocale: () => {},
  t: en,
});

export function LanguageProvider({
  initial,
  children,
}: {
  initial?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initial) return initial;
    try {
      return resolveLocale(localStorage.getItem(STORAGE_KEY));
    } catch {
      return detectLocale();
    }
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable (privacy mode) — locale still applies */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t: dictionaries[locale] }),
    [locale, setLocale],
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Current locale plus setter (header toggle) and dictionary. */
export function useLocale(): LocaleState {
  return useContext(LanguageContext);
}

/** Shorthand for the active string dictionary. */
export function useStrings(): Strings {
  return useContext(LanguageContext).t;
}
