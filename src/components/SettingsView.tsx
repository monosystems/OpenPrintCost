import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { CURRENCY_OPTIONS, currencySymbol } from "../api/currency";
import { useLocale } from "../i18n";
import { DEFAULT_CURRENCY, type CompanyInfo, type UpdateInfo } from "../api/types";

import { ErrorBanner, Field, PrimaryButton, Select, TextInput } from "./ui";

export function SettingsView({
  adapter,
  onUpdateChange,
}: {
  adapter: PlatformAdapter;
  /** Lets the header badge follow a manual check or a successful install. */
  onUpdateChange?: (update: UpdateInfo | null) => void;
}) {
  const { t } = useLocale();
  const [company, setCompany] = useState<CompanyInfo>({
    name: "",
    street: "",
    zip_city: "",
    email: "",
    currency: DEFAULT_CURRENCY,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const loaded = await adapter.getCompanyInfo();
      setCompany({ ...loaded, currency: loaded.currency?.trim() ? loaded.currency : DEFAULT_CURRENCY });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.companyLoad);
    }
  }, [adapter, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    try {
      await adapter.saveCompanyInfo({
        name: company.name.trim(),
        street: company.street.trim(),
        zip_city: company.zip_city.trim(),
        email: company.email.trim(),
        currency: company.currency.trim().toUpperCase() || DEFAULT_CURRENCY,
      });
      setSaved(true);
      setError(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.companySave);
    }
  };

  const set = (key: keyof CompanyInfo, value: string) => {
    setSaved(false);
    setCompany((current) => ({ ...current, [key]: value }));
  };

  return (
    <section aria-label={t.settings.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.settings.title}</h2>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <div className="mb-6 rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {t.settings.companyTitle}
        </h3>
        <p className="mb-4 text-xs text-ink-faint">{t.settings.companyHint}</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label={t.settings.name}>
            <TextInput value={company.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t.settings.email}>
            <TextInput value={company.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
          <Field label={t.settings.street}>
            <TextInput value={company.street} onChange={(e) => set("street", e.target.value)} />
          </Field>
          <Field label={t.settings.zipCity}>
            <TextInput value={company.zip_city} onChange={(e) => set("zip_city", e.target.value)} />
          </Field>
          <Field label={t.settings.currency}>
            <Select
              value={company.currency}
              onChange={(v) => set("currency", v)}
              options={CURRENCY_OPTIONS.map((code) => ({
                value: code,
                label: `${code} (${currencySymbol(code)})`,
              }))}
            />
          </Field>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton type="button" onClick={() => void save()}>
            {t.common.save}
          </PrimaryButton>
          {saved ? (
            <p role="status" className="text-sm text-accent">{t.settings.saved}</p>
          ) : null}
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {t.settings.environmentTitle}
        </h3>
        <DatabasePath adapter={adapter} />
      </div>

      <Updates adapter={adapter} onError={setError} onUpdateChange={onUpdateChange} />

      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {t.settings.aboutTitle}
        </h3>
        <p className="text-sm text-ink-muted">{t.settings.aboutText}</p>
      </div>
    </section>
  );
}

type UpdateStatus = "idle" | "checking" | "current" | "available" | "installing" | "installed";

/** Version, update check, and install — the server manifest is the only source. */
function Updates({
  adapter,
  onError,
  onUpdateChange,
}: {
  adapter: PlatformAdapter;
  onError: (message: string) => void;
  onUpdateChange?: (update: UpdateInfo | null) => void;
}) {
  const { t } = useLocale();
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    adapter
      .getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(null));
  }, [adapter]);

  const check = async () => {
    setStatus("checking");
    setUpdate(null);
    try {
      const found = await adapter.checkForUpdate();
      setUpdate(found);
      onUpdateChange?.(found);
      setStatus(found ? "available" : "current");
    } catch (error) {
      setStatus("idle");
      onError(error instanceof Error ? error.message : t.errors.updateCheck);
    }
  };

  const install = async () => {
    setStatus("installing");
    try {
      await adapter.installUpdate();
      onUpdateChange?.(null);
      // The desktop backend restarts the app; this only shows in the mock.
      setStatus("installed");
    } catch (error) {
      setStatus("available");
      onError(error instanceof Error ? error.message : t.errors.updateInstall);
    }
  };

  const busy = status === "checking" || status === "installing";

  return (
    <div className="mb-6 rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {t.settings.updatesTitle}
      </h3>
      <p className="text-sm text-ink-muted">
        {t.settings.updatesCurrentVersion(version ?? t.app.unknown)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <PrimaryButton type="button" onClick={() => void check()} disabled={busy}>
          {status === "checking" ? t.settings.updatesChecking : t.settings.updatesCheck}
        </PrimaryButton>
        {status === "available" && update ? (
          <PrimaryButton type="button" onClick={() => void install()}>
            {t.settings.updatesInstall}
          </PrimaryButton>
        ) : null}
      </div>

      {status === "current" ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          {t.settings.updatesUpToDate}
        </p>
      ) : null}
      {status === "installing" ? (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          {t.settings.updatesInstalling}
        </p>
      ) : null}
      {status === "installed" ? (
        <p role="status" className="mt-2 text-sm text-accent">
          {t.settings.updatesInstalled}
        </p>
      ) : null}
      {status === "available" && update ? (
        <div className="mt-2">
          <p className="text-sm text-accent">{t.settings.updatesAvailable(update.version)}</p>
          {update.notes ? (
            <p className="mt-1 whitespace-pre-line text-xs text-ink-muted">{update.notes}</p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-ink-faint">{t.settings.updatesManaged}</p>
    </div>
  );
}

function DatabasePath({ adapter }: { adapter: PlatformAdapter }) {
  const { t } = useLocale();
  const [path, setPath] = useState<string>(t.app.unknown);

  useEffect(() => {
    adapter
      .getDatabasePath()
      .then(setPath)
      .catch(() => setPath(t.app.unknown));
  }, [adapter, t]);

  return (
    <p className="font-mono text-xs text-ink-muted" title={path}>
      {t.app.database}: {path}
    </p>
  );
}
