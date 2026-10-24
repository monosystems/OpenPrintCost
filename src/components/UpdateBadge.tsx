import type { UpdateInfo } from "../api/types";
import { useLocale } from "../i18n";
import { DownloadIcon } from "./icons";

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
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-control border border-warning/30 bg-warning-soft px-2.5 text-sm font-medium text-warning transition-colors hover:bg-warning-soft/70"
    >
      <DownloadIcon className="h-4 w-4" />
      <span aria-hidden="true" className="hidden sm:inline">
        {t.app.updateBadge}
      </span>
    </button>
  );
}
