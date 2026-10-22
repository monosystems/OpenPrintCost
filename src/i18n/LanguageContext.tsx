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

/** Supported UI locales. English is the default; German stays available. */
export type Locale = "en" | "de";

const STORAGE_KEY = "opc-locale";

const dictionaries: Record<Locale, Strings> = { en, de };

/** Browser-language detection: German only on `de*`, otherwise English. */
export function detectLocale(): Locale {
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de")) {
    return "de";
  }
  return "en";
}

/** Stored preference wins; anything else falls back to detection. */
export function resolveLocale(stored: string | null | undefined): Locale {
  return stored === "de" || stored === "en" ? stored : detectLocale();
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
