import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { useLocale } from "../i18n";
import type { CompanyInfo } from "../api/types";
import { ErrorBanner, Field, PrimaryButton, TextInput } from "./ui";

const APP_VERSION = "0.1.0";

export function SettingsView({ adapter }: { adapter: PlatformAdapter }) {
  const { t } = useLocale();
  const [company, setCompany] = useState<CompanyInfo>({ name: "", street: "", zip_city: "", email: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setCompany(await adapter.getCompanyInfo());
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
        <h2 className="text-xl font-semibold text-slate-100">{t.settings.title}</h2>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-1 text-sm font-medium uppercase tracking-wide text-slate-400">
          {t.settings.companyTitle}
        </h3>
        <p className="mb-4 text-xs text-slate-500">{t.settings.companyHint}</p>
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
        </div>
        <div className="mt-4 flex items-center gap-3">
          <PrimaryButton type="button" onClick={() => void save()}>
            {t.common.save}
          </PrimaryButton>
          {saved ? (
            <p role="status" className="text-sm text-emerald-400">{t.settings.saved}</p>
          ) : null}
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
          {t.settings.environmentTitle}
        </h3>
        <DatabasePath adapter={adapter} />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
          {t.settings.aboutTitle}
        </h3>
        <p className="mb-2 text-sm text-slate-300">{t.settings.aboutText}</p>
        <p className="text-xs text-slate-500">Version {APP_VERSION}</p>
      </div>
    </section>
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
    <p className="text-sm text-slate-300" title={path}>
      {t.app.database}: {path}
    </p>
  );
}
