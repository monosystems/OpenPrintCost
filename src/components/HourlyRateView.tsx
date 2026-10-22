import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type HourlyRate, type TimeBasis } from "../api/types";
import {
  ConfirmDialog,
  DangerButton,
  DecimalInput,
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "./ui";

function emptyRate(): HourlyRate {
  return {
    id: newId(),
    name: "",
    time_basis: "per-year",
    machine_hours: "0",
    replacement_cost: "0",
    service_life_years: "0",
    interest_rate_percent: "0",
    maintenance_fixed: "0",
    rent_fixed: "0",
    electricity_fixed: "0",
    additional_fixed: "0",
    maintenance_variable: "0",
    electricity_variable: "0",
    additional_variable: "0",
    fixed_rate_override: null,
  };
}

type Errors = Partial<Record<string, string>>;

function validate(rate: HourlyRate, t: Strings): Errors {
  const required: ReadonlyArray<readonly [keyof HourlyRate, string]> = [
    ["machine_hours", t.rates.machineHours],
    ["replacement_cost", t.rates.replacement],
    ["service_life_years", t.rates.serviceLife],
    ["interest_rate_percent", t.rates.interest],
    ["maintenance_fixed", `${t.rates.maintenanceFixed} (fix)`],
    ["rent_fixed", `${t.rates.rentFixed} (fix)`],
    ["electricity_fixed", `${t.rates.electricityFixed} (fix)`],
    ["additional_fixed", `${t.rates.additionalFixed} (fix)`],
    ["maintenance_variable", `${t.rates.maintenanceVariable} (variabel)`],
    ["electricity_variable", `${t.rates.electricityVariable} (variabel)`],
    ["additional_variable", `${t.rates.additionalVariable} (variabel)`],
  ];
  const errors: Errors = {};
  if (rate.name.trim() === "") errors.name = t.validation.required(t.validation.designation);
  for (const [key, label] of required) {
    if (!isDecimalString(rate[key] as string)) {
      errors[key] = t.validation.decimal(label);
    }
  }
  if (rate.fixed_rate_override !== null && rate.fixed_rate_override !== "" && !isDecimalString(rate.fixed_rate_override)) {
    errors.fixed_rate_override = t.validation.decimalOrEmpty(t.rates.fixedOverride);
  }
  return errors;
}

export function HourlyRateView({ adapter }: { adapter: PlatformAdapter }) {
  const { t, locale } = useLocale();
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HourlyRate | null>(null);
  const [deleting, setDeleting] = useState<HourlyRate | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRates(await adapter.listHourlyRates());
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.ratesLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditing(emptyRate());
    setFormErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing, t);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const cleaned: HourlyRate = {
      ...editing,
      name: editing.name.trim(),
      fixed_rate_override: editing.fixed_rate_override?.trim()
        ? editing.fixed_rate_override.trim()
        : null,
    };
    try {
      await adapter.saveHourlyRate(cleaned);
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.rateSave);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await adapter.deleteHourlyRate(deleting.id);
      setDeleting(null);
      await reload();
    } catch (error) {
      setDeleting(null);
      setError(error instanceof Error ? error.message : t.errors.rateDelete);
    }
  };

  const set = <K extends keyof HourlyRate>(key: K, value: HourlyRate[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  return (
    <section aria-label={t.rates.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">{t.rates.title}</h2>
        <PrimaryButton type="button" onClick={openNew}>
          {t.rates.newButton}
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-slate-400">{t.common.loading}</p>
      ) : rates.length === 0 ? (
        <EmptyState message={t.rates.empty} />
      ) : (
        <ul className="space-y-2">
          {rates.map((rate) => (
            <li
              key={rate.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{rate.name}</p>
                <p className="text-xs text-slate-400">
                  {t.domain.timeBasis[rate.time_basis]} · {formatMoney(rate.machine_hours, locale)} h
                  {rate.fixed_rate_override
                    ? ` · ${t.rates.free}: ${formatMoney(rate.fixed_rate_override, locale)} €/h`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton type="button" onClick={() => { setEditing({ ...rate }); setFormErrors({}); }}>
                  {t.common.edit}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => setDeleting(rate)}>
                  {t.common.delete}
                </DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal title={rates.some((r) => r.id === editing.id) ? t.rates.editTitle : t.rates.newTitle} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label={`${t.rates.name} *`} error={formErrors.name}>
                <TextInput value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder={t.rates.nameExample} />
              </Field>
            </div>
            <Field label={t.rates.timeBasis}>
              <Select
                value={editing.time_basis}
                onChange={(v) => set("time_basis", v as TimeBasis)}
                options={Object.entries(t.domain.timeBasis).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label={`${t.rates.machineHours} *`} error={formErrors.machine_hours}>
              <DecimalInput value={editing.machine_hours} onChange={(v) => set("machine_hours", v)} />
            </Field>
            <Field label={`${t.rates.replacement} *`} error={formErrors.replacement_cost}>
              <DecimalInput value={editing.replacement_cost} onChange={(v) => set("replacement_cost", v)} />
            </Field>
            <Field label={`${t.rates.serviceLife} *`} error={formErrors.service_life_years}>
              <DecimalInput value={editing.service_life_years} onChange={(v) => set("service_life_years", v)} />
            </Field>
            <Field label={`${t.rates.interest} *`} error={formErrors.interest_rate_percent}>
              <DecimalInput value={editing.interest_rate_percent} onChange={(v) => set("interest_rate_percent", v)} />
            </Field>
            <Field label={t.rates.fixedOverride} error={formErrors.fixed_rate_override}>
              <DecimalInput value={editing.fixed_rate_override ?? ""} onChange={(v) => set("fixed_rate_override", v)} />
            </Field>
          </div>

          <fieldset className="mt-4 rounded-lg border border-slate-800 p-4">
            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              {t.rates.fixedGroup} {editing.time_basis === "per-year" ? t.rates.perYear : t.rates.perMonth} (€)
            </legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={`${t.rates.maintenanceFixed} *`} error={formErrors.maintenance_fixed}>
                <DecimalInput value={editing.maintenance_fixed} onChange={(v) => set("maintenance_fixed", v)} />
              </Field>
              <Field label={`${t.rates.rentFixed} *`} error={formErrors.rent_fixed}>
                <DecimalInput value={editing.rent_fixed} onChange={(v) => set("rent_fixed", v)} />
              </Field>
              <Field label={`${t.rates.electricityFixed} *`} error={formErrors.electricity_fixed}>
                <DecimalInput value={editing.electricity_fixed} onChange={(v) => set("electricity_fixed", v)} />
              </Field>
              <Field label={`${t.rates.additionalFixed} *`} error={formErrors.additional_fixed}>
                <DecimalInput value={editing.additional_fixed} onChange={(v) => set("additional_fixed", v)} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="mt-4 rounded-lg border border-slate-800 p-4">
            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              {t.rates.variableGroup}
            </legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={`${t.rates.maintenanceVariable} *`} error={formErrors.maintenance_variable}>
                <DecimalInput value={editing.maintenance_variable} onChange={(v) => set("maintenance_variable", v)} />
              </Field>
              <Field label={`${t.rates.electricityVariable} *`} error={formErrors.electricity_variable}>
                <DecimalInput value={editing.electricity_variable} onChange={(v) => set("electricity_variable", v)} />
              </Field>
              <Field label={`${t.rates.additionalVariable} *`} error={formErrors.additional_variable}>
                <DecimalInput value={editing.additional_variable} onChange={(v) => set("additional_variable", v)} />
              </Field>
            </div>
          </fieldset>

          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setEditing(null)}>
              {t.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => void save()}>
              {t.common.save}
            </PrimaryButton>
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t.common.confirmTitle(t.rates.one)}
          message={t.common.confirmDeleteMessage(deleting.name)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
