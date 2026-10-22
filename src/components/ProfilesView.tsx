import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { isDecimalString } from "../api/format";
import { de } from "../i18n/de";
import { newId, type CalculationProfile } from "../api/types";
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

const DECIMALS: ReadonlyArray<readonly [keyof CalculationProfile, string]> = [
  ["fail_rate_percent", de.profiles.failRate],
  ["tax_rate_percent", de.profiles.tax],
  ["margin_percent", de.profiles.margin],
  ["handling_fee", de.profiles.handlingFee],
  ["energy_price_per_kwh", de.profiles.energyPrice],
  ["power_level_percent", de.profiles.powerLevel],
  ["print_time_factor", de.profiles.printTimeFactor],
];

function validate(profile: CalculationProfile): Errors {
  const errors: Errors = {};
  if (profile.name.trim() === "") errors.name = de.validation.required(de.validation.designation);
  for (const [key, label] of DECIMALS) {
    if (!isDecimalString(profile[key] as string)) {
      errors[key] = de.validation.decimal(label);
    }
  }
  return errors;
}

export function ProfilesView({ adapter }: { adapter: PlatformAdapter }) {
  const [profiles, setProfiles] = useState<CalculationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CalculationProfile | null>(null);
  const [deleting, setDeleting] = useState<CalculationProfile | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles(await adapter.listCalculationProfiles());
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : de.errors.profilesLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await adapter.saveCalculationProfile({ ...editing, name: editing.name.trim() });
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : de.errors.profileSave);
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
      setError(error instanceof Error ? error.message : de.errors.profileDelete);
    }
  };

  const set = <K extends keyof CalculationProfile>(key: K, value: CalculationProfile[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  const check = (label: string, key: "apply_energy_costs" | "combine_materials" | "multiply_print_time_with_quantity" | "exclude_machine_from_margin" | "exclude_material_from_margin" | "exclude_worksteps_from_margin") => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={Boolean(editing?.[key])}
        onChange={(e) => set(key, e.target.checked)}
        className="h-4 w-4 accent-sky-600"
      />
      {label}
    </label>
  );

  return (
    <section aria-label={de.profiles.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">{de.profiles.title}</h2>
        <PrimaryButton type="button" onClick={() => { setEditing(emptyProfile()); setFormErrors({}); }}>
          {de.profiles.newButton}
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-slate-400">{de.common.loading}</p>
      ) : profiles.length === 0 ? (
        <EmptyState message={de.profiles.empty} />
      ) : (
        <ul className="space-y-2">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{profile.name}</p>
                <p className="text-xs text-slate-400">
                  {profile.margin_percent} % Marge · {profile.tax_rate_percent} % Steuer ·{" "}
                  {profile.fail_rate_percent} % Fehler
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton type="button" onClick={() => { setEditing({ ...profile }); setFormErrors({}); }}>
                  {de.common.edit}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => setDeleting(profile)}>
                  {de.common.delete}
                </DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal title={profiles.some((p) => p.id === editing.id) ? de.profiles.editTitle : de.profiles.newTitle} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="col-span-2 md:col-span-4">
              <Field label={`${de.profiles.name} *`} error={formErrors.name}>
                <TextInput value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder={de.profiles.nameExample} />
              </Field>
            </div>
            {DECIMALS.map(([key, label]) => (
              <Field key={key} label={label} error={formErrors[key]}>
                <DecimalInput value={editing[key] as string} onChange={(v) => set(key, v)} />
              </Field>
            ))}
            <Field label={de.profiles.handlingScope}>
              <Select
                value={editing.handling_fee_scope}
                onChange={(v) => set("handling_fee_scope", v as "per-file" | "once")}
                options={[
                  { value: "once", label: de.profiles.once },
                  { value: "per-file", label: de.profiles.perFile },
                ]}
              />
            </Field>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
            {check(de.profiles.applyEnergy, "apply_energy_costs")}
            {check(de.profiles.combine, "combine_materials")}
            {check(de.profiles.multiplyTime, "multiply_print_time_with_quantity")}
            {check(de.profiles.excludeMachine, "exclude_machine_from_margin")}
            {check(de.profiles.excludeMaterial, "exclude_material_from_margin")}
            {check(de.profiles.excludeWorksteps, "exclude_worksteps_from_margin")}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setEditing(null)}>
              {de.common.cancel}
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => void save()}>
              {de.common.save}
            </PrimaryButton>
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={de.common.confirmTitle(de.profiles.one)}
          message={de.common.confirmDeleteMessage(deleting.name)}
          confirmLabel={de.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
