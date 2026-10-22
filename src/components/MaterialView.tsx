import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, formatQuantity, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type Material, type MaterialFamily, type MaterialUnit } from "../api/types";
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

function emptyMaterial(): Material {
  return {
    id: newId(),
    name: "",
    material_type: "",
    family: "filament",
    manufacturer: null,
    shop_link: null,
    density_g_cm3: "1.24",
    package_size: "1",
    unit: "kg",
    price: "0",
    properties: {},
  };
}

type Errors = Partial<Record<string, string>>;

function validate(material: Material, t: Strings): Errors {
  const errors: Errors = {};
  if (material.name.trim() === "") errors.name = t.validation.required(t.validation.designation);
  if (material.material_type.trim() === "") errors.material_type = t.validation.required(t.validation.materialType);
  for (const [key, label] of [
    ["density_g_cm3", t.materials.density],
    ["package_size", t.materials.packageSize],
    ["price", t.materials.price],
  ] as const) {
    if (!isDecimalString(material[key])) {
      errors[key] = t.validation.decimal(label);
    }
  }
  return errors;
}

export function MaterialView({ adapter }: { adapter: PlatformAdapter }) {
  const { t, locale } = useLocale();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setMaterials(await adapter.listMaterials());
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.materialsLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditing(emptyMaterial());
    setFormErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing, t);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const cleaned: Material = {
      ...editing,
      name: editing.name.trim(),
      material_type: editing.material_type.trim(),
      manufacturer: editing.manufacturer?.trim() ? editing.manufacturer.trim() : null,
      shop_link: editing.shop_link?.trim() ? editing.shop_link.trim() : null,
    };
    try {
      await adapter.saveMaterial(cleaned);
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.materialSave);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await adapter.deleteMaterial(deleting.id);
      setDeleting(null);
      await reload();
    } catch (error) {
      setDeleting(null);
      setError(error instanceof Error ? error.message : t.errors.materialDelete);
    }
  };

  const set = <K extends keyof Material>(key: K, value: Material[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  return (
    <section aria-label={t.materials.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">{t.materials.title}</h2>
        <PrimaryButton type="button" onClick={openNew}>
          {t.materials.newButton}
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-slate-400">{t.common.loading}</p>
      ) : materials.length === 0 ? (
        <EmptyState message={t.materials.empty} />
      ) : (
        <ul className="space-y-2">
          {materials.map((material) => (
            <li
              key={material.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{material.name}</p>
                <p className="text-xs text-slate-400">
                  {material.material_type} · {t.domain.family[material.family]} ·{" "}
                  {formatMoney(material.price, locale)} € / {formatQuantity(material.package_size, locale)}{" "}
                  {t.domain.unit[material.unit]}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton type="button" onClick={() => { setEditing({ ...material }); setFormErrors({}); }}>
                  {t.common.edit}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => setDeleting(material)}>
                  {t.common.delete}
                </DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal title={materials.some((m) => m.id === editing.id) ? t.materials.editTitle : t.materials.newTitle} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label={`${t.materials.name} *`} error={formErrors.name}>
              <TextInput value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder={t.materials.nameExample} />
            </Field>
            <Field label={`${t.materials.type} *`} error={formErrors.material_type}>
              <TextInput value={editing.material_type} onChange={(e) => set("material_type", e.target.value)} placeholder={t.materials.typeExample} />
            </Field>
            <Field label={t.materials.family}>
              <Select
                value={editing.family}
                onChange={(v) => set("family", v as MaterialFamily)}
                options={Object.entries(t.domain.family).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label={t.materials.manufacturer}>
              <TextInput value={editing.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} />
            </Field>
            <Field label={`${t.materials.density} *`} error={formErrors.density_g_cm3}>
              <DecimalInput value={editing.density_g_cm3} onChange={(v) => set("density_g_cm3", v)} />
            </Field>
            <Field label={`${t.materials.price} *`} error={formErrors.price}>
              <DecimalInput value={editing.price} onChange={(v) => set("price", v)} />
            </Field>
            <Field label={`${t.materials.packageSize} *`} error={formErrors.package_size}>
              <DecimalInput value={editing.package_size} onChange={(v) => set("package_size", v)} />
            </Field>
            <Field label={t.materials.unit}>
              <Select
                value={editing.unit}
                onChange={(v) => set("unit", v as MaterialUnit)}
                options={[
                  { value: "kg", label: t.materials.unitKg },
                  { value: "g", label: t.materials.unitG },
                  { value: "lb", label: t.materials.unitLb },
                  { value: "oz", label: t.materials.unitOz },
                ]}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label={t.materials.shopLink}>
                <TextInput value={editing.shop_link ?? ""} onChange={(e) => set("shop_link", e.target.value)} placeholder="https://…" />
              </Field>
            </div>
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
          title={t.common.confirmTitle(t.materials.one)}
          message={t.common.confirmDeleteMessage(deleting.name)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
