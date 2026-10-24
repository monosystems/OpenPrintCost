import type { UpdateInfo } from "../api/types";
import { useLocale } from "../i18n";

/**
 * Small header badge that appears only while the release server offers a
 * newer version. Clicking it opens Settings → Updates, where the release
 * notes and the install button live.
 */
export function UpdateBadge({
  update,
  onOpen,
}: {
  update: UpdateInfo | null;
  onOpen: () => void;
}) {
  const { t } = useLocale();
  if (!update) return null;

  const label = t.app.updateAvailable(update.version);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <span aria-hidden="true">↑</span>
      <span aria-hidden="true" className="hidden sm:inline">
        {t.app.updateBadge}
      </span>
    </button>
  );
}
