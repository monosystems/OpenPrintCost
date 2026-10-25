import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type CalculationProfile } from "../api/types";
import { DataTable, type DataColumn } from "./DataTable";
import { CalculatorIcon } from "./icons";
import {
  Checkbox,
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

function emptyProfile(): CalculationProfile {
  return {
    id: newId(),
    name: "",
    fail_rate_percent: "0",
    tax_rate_percent: "19",
    margin_percent: "0",
    handling_fee: "0",
    handling_fee_scope: "once",
    energy_price_per_kwh: "0.35",
    apply_energy_costs: true,
    power_level_percent: "100",
    combine_materials: false,
    multiply_print_time_with_quantity: true,
    print_time_factor: "1",
    exclude_machine_from_margin: false,
    exclude_material_from_margin: false,
    exclude_worksteps_from_margin: false,
  };
}

type Errors = Partial<Record<string, string>>;

function decimals(t: Strings): ReadonlyArray<readonly [keyof CalculationProfile, string]> {
  return [
    ["fail_rate_percent", t.profiles.failRate],
    ["tax_rate_percent", t.profiles.tax],
    ["margin_percent", t.profiles.margin],
    ["handling_fee", t.profiles.handlingFee],
    ["energy_price_per_kwh", t.profiles.energyPrice],
    ["power_level_percent", t.profiles.powerLevel],
    ["print_time_factor", t.profiles.printTimeFactor],
  ];
}

function validate(profile: CalculationProfile, t: Strings): Errors {
  const errors: Errors = {};
  if (profile.name.trim() === "") errors.name = t.validation.required(t.validation.designation);
  for (const [key, label] of decimals(t)) {
    if (!isDecimalString(profile[key] as string)) {
      errors[key] = t.validation.decimal(label);
    }
  }
  return errors;
}

export function ProfilesView({ adapter }: { adapter: PlatformAdapter }) {
  const { t, locale } = useLocale();
  const [profiles, setProfiles] = useState<CalculationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalculationProfile | null>(null);
  const [deleting, setDeleting] = useState<CalculationProfile | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await adapter.listCalculationProfiles());
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.profilesLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing, t);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await adapter.saveCalculationProfile({ ...editing, name: editing.name.trim() });
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.profileSave);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await adapter.deleteCalculationProfile(deleting.id);
      setDeleting(null);
      await reload();
    } catch (error) {
      setDeleting(null);
      setError(error instanceof Error ? error.message : t.errors.profileDelete);
    }
  };

  const set = <K extends keyof CalculationProfile>(key: K, value: CalculationProfile[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  const columns: ReadonlyArray<DataColumn<CalculationProfile>> = [
    {
      key: "name",
      header: t.profiles.name,
      sortValue: (profile) => profile.name,
      render: (profile) => <p className="font-medium text-ink">{profile.name}</p>,
    },
    {
      key: "tax",
      header: t.profiles.tax,
      align: "right",
      sortValue: (profile) => Number(profile.tax_rate_percent),
      render: (profile) => `${profile.tax_rate_percent} %`,
    },
    {
      key: "margin",
      header: t.profiles.margin,
      align: "right",
      sortValue: (profile) => Number(profile.margin_percent),
      render: (profile) => `${profile.margin_percent} %`,
    },
    {
      key: "fail",
      header: t.profiles.failRate,
      align: "right",
      sortValue: (profile) => Number(profile.fail_rate_percent),
      render: (profile) => `${profile.fail_rate_percent} %`,
    },
    {
      key: "handling",
      header: t.profiles.handlingFee,
      align: "right",
      sortValue: (profile) => Number(profile.handling_fee),
      render: (profile) => `${formatMoney(profile.handling_fee, locale)} €`,
    },
    {
      key: "actions",
      header: t.common.actions,
      align: "right",
      render: (profile) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing({ ...profile });
              setFormErrors({});
            }}
          >
            {t.common.edit}
          </SecondaryButton>
          <DangerGhostButton type="button" onClick={() => setDeleting(profile)}>
            {t.common.delete}
          </DangerGhostButton>
        </div>
      ),
    },
  ];

  const check = (label: string, key: "apply_energy_costs" | "combine_materials" | "multiply_print_time_with_quantity" | "exclude_machine_from_margin" | "exclude_material_from_margin" | "exclude_worksteps_from_margin") => (
    <Checkbox
      checked={Boolean(editing?.[key])}
      onChange={(checked) => set(key, checked)}
      label={label}
    />
  );

  return (
    <section aria-label={t.profiles.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.profiles.title}</h2>
        {profiles.length > 0 ? (
          <PrimaryButton type="button" onClick={() => { setEditing(emptyProfile()); setFormErrors({}); }}>
            {t.profiles.newButton}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-ink-muted">{t.common.loading}</p>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={<CalculatorIcon />}
          message={t.profiles.empty}
          action={
            <PrimaryButton
              type="button"
              onClick={() => {
                setEditing(emptyProfile());
                setFormErrors({});
              }}
            >
              {t.profiles.newButton}
            </PrimaryButton>
          }
        />
      ) : (
        <DataTable
          label={t.profiles.title}
          rows={profiles}
          columns={columns}
          rowKey={(profile) => profile.id}
          searchText={(profile) => profile.name}
        />
      )}

      {editing ? (
        <Modal
          title={profiles.some((p) => p.id === editing.id) ? t.profiles.editTitle : t.profiles.newTitle}
          description={t.profiles.formDescription}
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
            <FormSection title={t.profiles.sectionGeneral}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-12">
                  <Field label={`${t.profiles.name} *`} error={formErrors.name}>
                    <TextInput
                      autoFocus
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.name)}
                      value={editing.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder={t.profiles.nameExample}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={t.profiles.sectionCalculation}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-3">
                  <Field label={t.profiles.failRate} error={formErrors.fail_rate_percent}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.fail_rate_percent)}
                      value={editing.fail_rate_percent}
                      onChange={(v) => set("fail_rate_percent", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-3">
                  <Field label={t.profiles.tax} error={formErrors.tax_rate_percent}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.tax_rate_percent)}
                      value={editing.tax_rate_percent}
                      onChange={(v) => set("tax_rate_percent", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-3">
                  <Field label={t.profiles.margin} error={formErrors.margin_percent}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.margin_percent)}
                      value={editing.margin_percent}
                      onChange={(v) => set("margin_percent", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-3">
                  <Field label={t.profiles.handlingFee} error={formErrors.handling_fee}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.handling_fee)}
                      value={editing.handling_fee}
                      onChange={(v) => set("handling_fee", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.profiles.handlingScope}>
                    <Select
                      value={editing.handling_fee_scope}
                      onChange={(v) => set("handling_fee_scope", v as "per-file" | "once")}
                      options={[
                        { value: "once", label: t.profiles.once },
                        { value: "per-file", label: t.profiles.perFile },
                      ]}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.profiles.printTimeFactor} error={formErrors.print_time_factor}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.print_time_factor)}
                      value={editing.print_time_factor}
                      onChange={(v) => set("print_time_factor", v)}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={t.profiles.sectionEnergy}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Field label={t.profiles.energyPrice} error={formErrors.energy_price_per_kwh}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.energy_price_per_kwh)}
                      value={editing.energy_price_per_kwh}
                      onChange={(v) => set("energy_price_per_kwh", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.profiles.powerLevel} error={formErrors.power_level_percent}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.power_level_percent)}
                      value={editing.power_level_percent}
                      onChange={(v) => set("power_level_percent", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-12">
                  {check(t.profiles.applyEnergy, "apply_energy_costs")}
                </div>
              </div>
            </FormSection>

            <FormSection title={t.profiles.sectionOptions}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {check(t.profiles.combine, "combine_materials")}
                {check(t.profiles.multiplyTime, "multiply_print_time_with_quantity")}
                {check(t.profiles.excludeMachine, "exclude_machine_from_margin")}
                {check(t.profiles.excludeMaterial, "exclude_material_from_margin")}
                {check(t.profiles.excludeWorksteps, "exclude_worksteps_from_margin")}
              </div>
            </FormSection>
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t.common.confirmTitle(t.profiles.one)}
          message={t.common.confirmDeleteMessage(deleting.name)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
