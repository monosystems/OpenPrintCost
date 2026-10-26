import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, formatQuantity, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type HourlyRate, type TimeBasis } from "../api/types";
import { useCurrencySymbol } from "../hooks/useCurrencySymbol";
import { DataTable, type DataColumn } from "./DataTable";
import { ClockIcon } from "./icons";
import {
  ConfirmDialog,
  DangerGhostButton,
  DecimalInput,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
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
  const currency = useCurrencySymbol(adapter);
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HourlyRate | null>(null);
  const [deleting, setDeleting] = useState<HourlyRate | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await adapter.saveHourlyRate(cleaned);
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.rateSave);
    } finally {
      setSaving(false);
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

  const columns: ReadonlyArray<DataColumn<HourlyRate>> = [
    {
      key: "name",
      header: t.rates.name,
      sortValue: (rate) => rate.name,
      render: (rate) => <p className="font-medium text-ink">{rate.name}</p>,
    },
    {
      key: "basis",
      header: t.rates.timeBasis,
      render: (rate) => <span className="capitalize">{t.domain.timeBasis[rate.time_basis]}</span>,
    },
    {
      key: "hours",
      header: t.rates.machineHours,
      align: "right",
      sortValue: (rate) => Number(rate.machine_hours),
      render: (rate) => `${formatQuantity(rate.machine_hours, locale)} h`,
    },
    {
      key: "override",
      header: `${t.rates.fixedOverrideShort} (${currency}/h)`,
      align: "right",
      sortValue: (rate) => Number(rate.fixed_rate_override ?? 0),
      render: (rate) =>
        rate.fixed_rate_override
          ? `${formatMoney(rate.fixed_rate_override, locale)} ${currency}/h`
          : "—",
    },
    {
      key: "actions",
      header: t.common.actions,
      align: "right",
      render: (rate) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing({ ...rate });
              setFormErrors({});
            }}
          >
            {t.common.edit}
          </SecondaryButton>
          <DangerGhostButton type="button" onClick={() => setDeleting(rate)}>
            {t.common.delete}
          </DangerGhostButton>
        </div>
      ),
    },
  ];

  return (
    <section aria-label={t.rates.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.rates.title}</h2>
        {rates.length > 0 ? (
          <PrimaryButton type="button" onClick={openNew}>
            {t.rates.newButton}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-ink-muted">{t.common.loading}</p>
      ) : rates.length === 0 ? (
        <EmptyState
          icon={<ClockIcon />}
          message={t.rates.empty}
          action={
            <PrimaryButton type="button" onClick={openNew}>
              {t.rates.newButton}
            </PrimaryButton>
          }
        />
      ) : (
        <DataTable
          label={t.rates.title}
          rows={rates}
          columns={columns}
          rowKey={(rate) => rate.id}
          searchText={(rate) => [rate.name, rate.time_basis].join(" ")}
        />
      )}

      {editing ? (
        <Modal
          title={rates.some((r) => r.id === editing.id) ? t.rates.editTitle : t.rates.newTitle}
          description={t.rates.formDescription}
          onClose={() => setEditing(null)}
          footer={
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-ink-faint">{t.common.requiredHint}</p>
              <div className="flex justify-end gap-3">
                <SecondaryButton type="button" onClick={() => setEditing(null)}>
                  {t.common.cancel}
                </SecondaryButton>
                <PrimaryButton type="button" loading={saving} onClick={() => void save()}>
                  {t.common.save}
                </PrimaryButton>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            <FormSection title={t.rates.sectionGeneral}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-7">
                  <Field label={`${t.rates.name} *`} error={formErrors.name}>
                    <TextInput
                      autoFocus
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.name)}
                      value={editing.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder={t.rates.nameExample}
                    />
                  </Field>
                </div>
                <div className="md:col-span-5">
                  <Field label={t.rates.timeBasis}>
                    <Select
                      value={editing.time_basis}
                      onChange={(v) => set("time_basis", v as TimeBasis)}
                      options={Object.entries(t.domain.timeBasis).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field
                    label={`${t.rates.fixedOverride} (${currency}/h)`}
                    error={formErrors.fixed_rate_override}
                  >
                    <DecimalInput
                      aria-invalid={Boolean(formErrors.fixed_rate_override)}
                      value={editing.fixed_rate_override ?? ""}
                      onChange={(v) => set("fixed_rate_override", v)}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={t.rates.sectionMachine}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Field label={`${t.rates.machineHours} *`} error={formErrors.machine_hours}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.machine_hours)}
                      value={editing.machine_hours}
                      onChange={(v) => set("machine_hours", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={`${t.rates.replacement} (${currency}) *`} error={formErrors.replacement_cost}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.replacement_cost)}
                      value={editing.replacement_cost}
                      onChange={(v) => set("replacement_cost", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={`${t.rates.serviceLife} *`} error={formErrors.service_life_years}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.service_life_years)}
                      value={editing.service_life_years}
                      onChange={(v) => set("service_life_years", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={`${t.rates.interest} *`} error={formErrors.interest_rate_percent}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.interest_rate_percent)}
                      value={editing.interest_rate_percent}
                      onChange={(v) => set("interest_rate_percent", v)}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              title={`${t.rates.fixedGroup} ${
                editing.time_basis === "per-year" ? t.rates.perYear : t.rates.perMonth
              } (${currency})`}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Field label={`${t.rates.maintenanceFixed} *`} error={formErrors.maintenance_fixed}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.maintenance_fixed)}
                      value={editing.maintenance_fixed}
                      onChange={(v) => set("maintenance_fixed", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={`${t.rates.rentFixed} *`} error={formErrors.rent_fixed}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.rent_fixed)}
                      value={editing.rent_fixed}
                      onChange={(v) => set("rent_fixed", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={`${t.rates.electricityFixed} *`} error={formErrors.electricity_fixed}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.electricity_fixed)}
                      value={editing.electricity_fixed}
                      onChange={(v) => set("electricity_fixed", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={`${t.rates.additionalFixed} *`} error={formErrors.additional_fixed}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.additional_fixed)}
                      value={editing.additional_fixed}
                      onChange={(v) => set("additional_fixed", v)}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={`${t.rates.variableGroup} (${currency}/h)`}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Field label={`${t.rates.maintenanceVariable} *`} error={formErrors.maintenance_variable}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.maintenance_variable)}
                      value={editing.maintenance_variable}
                      onChange={(v) => set("maintenance_variable", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label={`${t.rates.electricityVariable} *`} error={formErrors.electricity_variable}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.electricity_variable)}
                      value={editing.electricity_variable}
                      onChange={(v) => set("electricity_variable", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label={`${t.rates.additionalVariable} *`} error={formErrors.additional_variable}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.additional_variable)}
                      value={editing.additional_variable}
                      onChange={(v) => set("additional_variable", v)}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>
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
