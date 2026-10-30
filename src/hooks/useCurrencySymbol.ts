import { useEffect, useState } from "react";
import { currencySymbol } from "../api/currency";
import type { PlatformAdapter } from "../api/platform";

/** Event, das nach einer Änderung der Firmenwährung ausgelöst wird. */
export const COMPANY_CHANGED_EVENT = "opc:company-changed";

/** Benachrichtigt alle gemounteten Ansichten über eine neue Firmenwährung. */
export function notifyCompanyChanged(): void {
  window.dispatchEvent(new Event(COMPANY_CHANGED_EVENT));
}

/** Lädt die Firmenwährung und aktualisiert sich bei Währungsänderungen. */
export function useCurrencySymbol(adapter: PlatformAdapter): string {
  const [symbol, setSymbol] = useState("$");
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      adapter
        .getCompanyInfo()
        .then((info) => {
          if (!cancelled) setSymbol(currencySymbol(info.currency));
        })
        .catch(() => undefined);
    };
    load();
    window.addEventListener(COMPANY_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(COMPANY_CHANGED_EVENT, load);
    };
  }, [adapter]);
  return symbol;
}
