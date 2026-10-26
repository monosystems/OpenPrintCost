import { useEffect, useState } from "react";
import { currencySymbol } from "../api/currency";
import type { PlatformAdapter } from "../api/platform";

/** Lädt die Firmenwährung einmal und liefert das Anzeige-Symbol (Fallback €). */
export function useCurrencySymbol(adapter: PlatformAdapter): string {
  const [symbol, setSymbol] = useState("€");
  useEffect(() => {
    let cancelled = false;
    adapter
      .getCompanyInfo()
      .then((info) => {
        if (!cancelled) setSymbol(currencySymbol(info.currency));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [adapter]);
  return symbol;
}
