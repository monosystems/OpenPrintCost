/**
 * Registry of supported UI locales.
 *
 * Adding a language means: add a dictionary (e.g. `fr.ts` with the `Strings`
 * shape), register it here, and add it to `dictionaries` in
 * `LanguageContext.tsx` — the compiler then enforces that the dictionary
 * exists and has the same shape.
 *
 * Language names are endonyms (each language in its own language) so that a
 * user finds their language even if they cannot read the current one.
 */
export const LOCALE_LABELS = {
  en: "English",
  de: "Deutsch",
} as const;

export type Locale = keyof typeof LOCALE_LABELS;

/** All selectable locales, in display order. */
export const LOCALES = Object.keys(LOCALE_LABELS) as Locale[];

/** Fallback when no preference is stored and detection is inconclusive. */
export const DEFAULT_LOCALE: Locale = "en";
