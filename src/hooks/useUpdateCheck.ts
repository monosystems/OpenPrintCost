import { useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import type { UpdateInfo } from "../api/types";

/**
 * How often the app asks the release server on its own. The first check runs
 * immediately on mount, so a new release is visible right after startup.
 */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Background update check. Returns the offered update, or `null` while the
 * running version is current.
 *
 * `noteUpdate` lets the manual check in Settings publish its result, so the
 * header badge stays in sync (e.g. after being offline at startup).
 *
 * Failures are swallowed on purpose: an automatic check must not interrupt
 * work (offline use is a first-class case). The manual check in Settings is
 * where errors are reported.
 */
export function useUpdateCheck(
  adapter: PlatformAdapter,
  intervalMs: number = UPDATE_CHECK_INTERVAL_MS,
): { update: UpdateInfo | null; noteUpdate: (update: UpdateInfo | null) => void } {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    let active = true;

    const check = () => {
      adapter
        .checkForUpdate()
        .then((found) => {
          if (active) setUpdate(found);
        })
        .catch(() => {
          // Silent — see the hook's contract above.
        });
    };

    check();
    const timer = window.setInterval(check, intervalMs);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [adapter, intervalMs]);

  return { update, noteUpdate: setUpdate };
}
