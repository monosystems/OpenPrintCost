import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import {
  formatMoney,
  formatQuantity,
  isDecimalString,
  multiplyDecimalStrings,
} from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type MaterialFamily, type PrintProcess, type Printer } from "../api/types";
import { PRINTER_PRESETS, referencePriceLabel } from "../data/printerPresets";
import { useCurrencySymbol } from "../hooks/useCurrencySymbol";
import { DataTable, type DataColumn } from "./DataTable";
import { PrinterIcon } from "./icons";
import { PresetTreeSelect } from "./PresetTreeSelect";
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

function emptyPrinter(): Printer {
  return {
    id: newId(),
    model: "",
    manufacturer: null,
    process: "fdm",
    material_family: "filament",
    power_watts: "0",
    build_width_mm: "0",
    build_depth_mm: "0",
    build_height_mm: "0",
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
    ["build_width_mm", t.printers.width],
    ["build_depth_mm", t.printers.depth],
    ["build_height_mm", t.printers.height],
    ["purchase_price", t.printers.price],
  ] as const) {
    if (!isDecimalString(printer[key])) {
      errors[key] = t.validation.decimal(label);
    } else if (Number(printer[key]) < 0) {
      errors[key] = t.validation.nonNegative(label);
    }
  }
  for (const [key, label] of [
    ["hourly_rate", t.printers.hourlyRate],
    ["nozzle_wear_cost", t.printers.nozzle],
    ["build_plate_wear_cost", t.printers.plate],
    ["material_change_cost", t.printers.materialChange],
  ] as const) {
    const value = printer[key];
    if (value !== null && value !== "") {
      if (!isDecimalString(value)) {
        errors[key] = t.validation.decimalOrEmpty(label);
      } else if (Number(value) < 0) {
        errors[key] = t.validation.nonNegative(label);
      }
    }
  }
  return errors;
}

export function PrinterView({ adapter }: { adapter: PlatformAdapter }) {
  const { t, locale } = useLocale();
  const currency = useCurrencySymbol(adapter);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Printer | null>(null);
  const [deleting, setDeleting] = useState<Printer | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  /** Dollar-Referenzpreis der zuletzt gewählten Vorlage (nur Hinweis). */
  const [presetReference, setPresetReference] = useState<string | null>(null);

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
    setPresetReference(null);
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
    setSaving(true);
    try {
      await adapter.savePrinter(cleaned);
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.printerSave);
    } finally {
      setSaving(false);
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

  const applyPreset = (key: string) => {
    const preset = PRINTER_PRESETS.find((entry) => entry.key === key);
    if (!preset || !editing) return;
    const { key: _ignored, ...values } = preset;
    // Der Preis ist ein Dollar-Referenzwert (US-Liste). Er wird als
    // Ausgangswert übernommen und muss durch den tatsächlichen Kaufpreis
    // in der eigenen Währung ersetzt werden (Hinweis unter dem Feld).
    // Unbekannte Werte (`null`) bleiben leer, damit die Pflichtfelder
    // den Nutzer zur Eingabe auffordern statt still mit 0 zu rechnen.
    setEditing((current) =>
      current
        ? {
            ...current,
            ...values,
            power_watts: preset.power_watts ?? "",
            purchase_price: preset.purchase_price ?? "",
          }
        : current,
    );
    setPresetReference(referencePriceLabel(preset));
    setFormErrors({});
  };

  const buildVolume = editing
    ? multiplyDecimalStrings([
        editing.build_width_mm,
        editing.build_depth_mm,
        editing.build_height_mm,
      ])
    : null;

  const columns: ReadonlyArray<DataColumn<Printer>> = [
    {
      key: "model",
      header: t.printers.model,
      sortValue: (printer) => printer.model,
      render: (printer) => (
        <div>
          <p className="font-medium text-ink">{printer.model}</p>
          {printer.manufacturer ? (
            <p className="text-xs text-ink-faint">{printer.manufacturer}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "process",
      header: t.printers.process,
      render: (printer) => t.domain.process[printer.process],
    },
    {
      key: "power",
      header: t.printers.power,
      align: "right",
      sortValue: (printer) => Number(printer.power_watts),
      render: (printer) => `${formatQuantity(printer.power_watts, locale)} W`,
    },
    {
      key: "price",
      header: `${t.printers.price} (${currency})`,
      align: "right",
      sortValue: (printer) => Number(printer.purchase_price),
      render: (printer) => `${formatMoney(printer.purchase_price, locale)} ${currency}`,
    },
    {
      key: "rate",
      header: `${t.printers.hourlyRateShort} (${currency}/h)`,
      align: "right",
      sortValue: (printer) => Number(printer.hourly_rate ?? 0),
      render: (printer) =>
        printer.hourly_rate ? `${formatMoney(printer.hourly_rate, locale)} ${currency}/h` : "—",
    },
    {
      key: "actions",
      header: t.common.actions,
      align: "right",
      render: (printer) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing({ ...printer });
              setFormErrors({});
              setPresetReference(null);
            }}
          >
            {t.common.edit}
          </SecondaryButton>
          <DangerGhostButton type="button" onClick={() => setDeleting(printer)}>
            {t.common.delete}
          </DangerGhostButton>
        </div>
      ),
    },
  ];

  return (
    <section aria-label={t.printers.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.printers.title}</h2>
        {printers.length > 0 ? (
          <PrimaryButton type="button" onClick={openNew}>
            {t.printers.newButton}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-ink-muted">{t.common.loading}</p>
      ) : printers.length === 0 ? (
        <EmptyState
          icon={<PrinterIcon />}
          message={t.printers.empty}
          action={
            <PrimaryButton type="button" onClick={openNew}>
              {t.printers.newButton}
            </PrimaryButton>
          }
        />
      ) : (
        <DataTable
          label={t.printers.title}
          rows={printers}
          columns={columns}
          rowKey={(printer) => printer.id}
          searchText={(printer) =>
            [printer.model, printer.manufacturer, printer.process, printer.power_watts]
              .filter(Boolean)
              .join(" ")
          }
        />
      )}

      {editing ? (
        <Modal
          title={printers.some((p) => p.id === editing.id) ? t.printers.editTitle : t.printers.newTitle}
          description={t.printers.formDescription}
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
            <div>
              <Field label={t.printers.presetLabel}>
                <PresetTreeSelect placeholder={t.printers.presetPick} onPick={applyPreset} />
              </Field>
              <p className="mt-1 text-xs text-ink-faint">{t.printers.presetHint}</p>
            </div>
            <FormSection title={t.printers.sectionDevice}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-7">
                  <Field label={`${t.printers.model} *`} error={formErrors.model}>
                    <TextInput
                      autoFocus
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.model)}
                      value={editing.model}
                      onChange={(e) => set("model", e.target.value)}
                      placeholder={t.printers.modelExample}
                    />
                  </Field>
                </div>
                <div className="md:col-span-5">
                  <Field label={t.printers.manufacturer}>
                    <TextInput
                      value={editing.manufacturer ?? ""}
                      onChange={(e) => set("manufacturer", e.target.value)}
                      placeholder={t.printers.manufacturerExample}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.printers.process}>
                    <Select
                      value={editing.process}
                      onChange={(v) => set("process", v as PrintProcess)}
                      options={Object.entries(t.domain.process).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.printers.materialFamily}>
                    <Select
                      value={editing.material_family}
                      onChange={(v) => set("material_family", v as MaterialFamily)}
                      options={Object.entries(t.domain.family).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={t.printers.sectionTechnical}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label={`${t.printers.width} *`} error={formErrors.build_width_mm}>
                      <DecimalInput
                        aria-required="true"
                        aria-invalid={Boolean(formErrors.build_width_mm)}
                        value={editing.build_width_mm}
                        onChange={(v) => set("build_width_mm", v)}
                      />
                    </Field>
                    <Field label={`${t.printers.depth} *`} error={formErrors.build_depth_mm}>
                      <DecimalInput
                        aria-required="true"
                        aria-invalid={Boolean(formErrors.build_depth_mm)}
                        value={editing.build_depth_mm}
                        onChange={(v) => set("build_depth_mm", v)}
                      />
                    </Field>
                    <Field label={`${t.printers.height} *`} error={formErrors.build_height_mm}>
                      <DecimalInput
                        aria-required="true"
                        aria-invalid={Boolean(formErrors.build_height_mm)}
                        value={editing.build_height_mm}
                        onChange={(v) => set("build_height_mm", v)}
                      />
                    </Field>
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    {t.printers.volume}:{" "}
                    <span className="font-mono tabular-nums text-ink-muted">
                      {buildVolume === null ? "—" : `${formatQuantity(buildVolume, locale)} mm³`}
                    </span>
                    {" · "}
                    {t.printers.volumeHint}
                  </p>
                </div>
                <Field label={`${t.printers.power} *`} error={formErrors.power_watts}>
                  <DecimalInput
                    aria-required="true"
                    aria-invalid={Boolean(formErrors.power_watts)}
                    value={editing.power_watts}
                    onChange={(v) => set("power_watts", v)}
                  />
                </Field>
              </div>
            </FormSection>

            <FormSection title={t.printers.sectionCosts}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Field
                    label={`${t.printers.price} (${currency}) *`}
                    error={formErrors.purchase_price}
                  >
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.purchase_price)}
                      value={editing.purchase_price}
                      onChange={(v) => set("purchase_price", v)}
                    />
                  </Field>
                  {presetReference ? (
                    <p role="note" className="mt-1.5 text-xs text-ink-faint">
                      {t.printers.presetReference(presetReference)}
                    </p>
                  ) : null}
                </div>
                <Field
                  label={`${t.printers.hourlyRate} (${currency}/h)`}
                  error={formErrors.hourly_rate}
                >
                  <DecimalInput
                    aria-invalid={Boolean(formErrors.hourly_rate)}
                    value={editing.hourly_rate ?? ""}
                    onChange={(v) => set("hourly_rate", v)}
                  />
                </Field>
                <Field
                  label={`${t.printers.nozzle} (${currency})`}
                  error={formErrors.nozzle_wear_cost}
                >
                  <DecimalInput
                    aria-invalid={Boolean(formErrors.nozzle_wear_cost)}
                    value={editing.nozzle_wear_cost ?? ""}
                    onChange={(v) => set("nozzle_wear_cost", v)}
                  />
                </Field>
                <Field
                  label={`${t.printers.plate} (${currency})`}
                  error={formErrors.build_plate_wear_cost}
                >
                  <DecimalInput
                    aria-invalid={Boolean(formErrors.build_plate_wear_cost)}
                    value={editing.build_plate_wear_cost ?? ""}
                    onChange={(v) => set("build_plate_wear_cost", v)}
                  />
                </Field>
                <Field
                  label={`${t.printers.materialChange} (${currency})`}
                  error={formErrors.material_change_cost}
                >
                  <DecimalInput
                    aria-invalid={Boolean(formErrors.material_change_cost)}
                    value={editing.material_change_cost ?? ""}
                    onChange={(v) => set("material_change_cost", v)}
                  />
                </Field>
              </div>
            </FormSection>
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
