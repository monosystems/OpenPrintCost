import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type MaterialFamily, type PrintProcess, type Printer } from "../api/types";
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

function emptyPrinter(): Printer {
  return {
    id: newId(),
    model: "",
    manufacturer: null,
    process: "fdm",
    material_family: "filament",
    power_watts: "0",
    build_volume_mm3: "0",
    purchase_price: "0",
    hourly_rate: null,
    nozzle_wear_cost: null,
    build_plate_wear_cost: null,
    material_change_cost: null,
    properties: {},
  };
}

type Errors = Partial<Record<string, string>>;

function validate(printer: Printer, t: Strings): Errors {
  const errors: Errors = {};
  if (printer.model.trim() === "") errors.model = t.validation.required(t.validation.modelName);
  for (const [key, label] of [
    ["power_watts", t.printers.power],
    ["build_volume_mm3", t.printers.volume],
    ["purchase_price", t.printers.price],
  ] as const) {
    if (!isDecimalString(printer[key])) errors[key] = t.validation.decimal(label);
  }
  for (const [key, label] of [
    ["hourly_rate", t.printers.hourlyRate],
    ["nozzle_wear_cost", t.printers.nozzle],
    ["build_plate_wear_cost", t.printers.plate],
    ["material_change_cost", t.printers.materialChange],
  ] as const) {
    const value = printer[key];
    if (value !== null && value !== "" && !isDecimalString(value)) {
      errors[key] = t.validation.decimalOrEmpty(label);
    }
  }
  return errors;
}

export function PrinterView({ adapter }: { adapter: PlatformAdapter }) {
  const { t, locale } = useLocale();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [deleting, setDeleting] = useState<Printer | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setPrinters(await adapter.listPrinters());
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.printersLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditing(emptyPrinter());
    setFormErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing, t);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const cleaned: Printer = {
      ...editing,
      model: editing.model.trim(),
      manufacturer: editing.manufacturer?.trim() ? editing.manufacturer.trim() : null,
      hourly_rate: editing.hourly_rate?.trim() ? editing.hourly_rate.trim() : null,
      nozzle_wear_cost: editing.nozzle_wear_cost?.trim() ? editing.nozzle_wear_cost.trim() : null,
      build_plate_wear_cost: editing.build_plate_wear_cost?.trim()
        ? editing.build_plate_wear_cost.trim()
        : null,
      material_change_cost: editing.material_change_cost?.trim()
        ? editing.material_change_cost.trim()
        : null,
    };
    try {
      await adapter.savePrinter(cleaned);
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.printerSave);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await adapter.deletePrinter(deleting.id);
      setDeleting(null);
      await reload();
    } catch (error) {
      setDeleting(null);
      setError(error instanceof Error ? error.message : t.errors.printerDelete);
    }
  };

  const set = <K extends keyof Printer>(key: K, value: Printer[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  return (
    <section aria-label={t.printers.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">{t.printers.title}</h2>
        <PrimaryButton type="button" onClick={openNew}>
          {t.printers.newButton}
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-slate-400">{t.common.loading}</p>
      ) : printers.length === 0 ? (
        <EmptyState message={t.printers.empty} />
      ) : (
        <ul className="space-y-2">
          {printers.map((printer) => (
            <li
              key={printer.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{printer.model}</p>
                <p className="text-xs text-slate-400">
                  {t.domain.process[printer.process]} · {t.domain.family[printer.material_family]} ·{" "}
                  {formatMoney(printer.power_watts, locale)} W
                  {printer.hourly_rate ? ` · ${formatMoney(printer.hourly_rate, locale)} €/h` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton type="button" onClick={() => { setEditing({ ...printer }); setFormErrors({}); }}>
                  {t.common.edit}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => setDeleting(printer)}>
                  {t.common.delete}
                </DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal title={printers.some((p) => p.id === editing.id) ? t.printers.editTitle : t.printers.newTitle} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={`${t.printers.model} *`} error={formErrors.model}>
              <TextInput value={editing.model} onChange={(e) => set("model", e.target.value)} placeholder={t.printers.modelExample} />
            </Field>
            <Field label={t.printers.manufacturer}>
              <TextInput value={editing.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} placeholder={t.printers.manufacturerExample} />
            </Field>
            <Field label={t.printers.process}>
              <Select
                value={editing.process}
                onChange={(v) => set("process", v as PrintProcess)}
                options={Object.entries(t.domain.process).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label={t.printers.materialFamily}>
              <Select
                value={editing.material_family}
                onChange={(v) => set("material_family", v as MaterialFamily)}
                options={Object.entries(t.domain.family).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label={`${t.printers.power} *`} error={formErrors.power_watts}>
              <DecimalInput value={editing.power_watts} onChange={(v) => set("power_watts", v)} />
            </Field>
            <Field label={`${t.printers.volume} *`} error={formErrors.build_volume_mm3}>
              <DecimalInput value={editing.build_volume_mm3} onChange={(v) => set("build_volume_mm3", v)} />
            </Field>
            <Field label={`${t.printers.price} *`} error={formErrors.purchase_price}>
              <DecimalInput value={editing.purchase_price} onChange={(v) => set("purchase_price", v)} />
            </Field>
            <Field label={t.printers.hourlyRate} error={formErrors.hourly_rate}>
              <DecimalInput value={editing.hourly_rate ?? ""} onChange={(v) => set("hourly_rate", v)} />
            </Field>
            <Field label={t.printers.nozzle} error={formErrors.nozzle_wear_cost}>
              <DecimalInput value={editing.nozzle_wear_cost ?? ""} onChange={(v) => set("nozzle_wear_cost", v)} />
            </Field>
            <Field label={t.printers.plate} error={formErrors.build_plate_wear_cost}>
              <DecimalInput value={editing.build_plate_wear_cost ?? ""} onChange={(v) => set("build_plate_wear_cost", v)} />
            </Field>
            <Field label={t.printers.materialChange} error={formErrors.material_change_cost}>
              <DecimalInput value={editing.material_change_cost ?? ""} onChange={(v) => set("material_change_cost", v)} />
            </Field>
          </div>
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
          title={t.common.confirmTitle(t.printers.one)}
          message={t.common.confirmDeleteMessage(deleting.model)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
