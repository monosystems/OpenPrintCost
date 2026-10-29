import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, formatQuantity, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { newId, type Material, type MaterialFamily, type MaterialUnit } from "../api/types";
import { useCurrencySymbol } from "../hooks/useCurrencySymbol";
import { DataTable, type DataColumn } from "./DataTable";
import { LayersIcon } from "./icons";
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
  const currency = useCurrencySymbol(adapter);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await adapter.saveMaterial(cleaned);
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.materialSave);
    } finally {
      setSaving(false);
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

  const columns: ReadonlyArray<DataColumn<Material>> = [
    {
      key: "name",
      header: t.materials.name,
      sortValue: (material) => material.name,
      render: (material) => (
        <div>
          <p className="font-medium text-ink">{material.name}</p>
          {material.manufacturer ? (
            <p className="text-xs text-ink-faint">{material.manufacturer}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "type",
      header: t.materials.type,
      render: (material) => material.material_type,
    },
    {
      key: "family",
      header: t.materials.family,
      render: (material) => t.domain.family[material.family],
    },
    {
      key: "price",
      header: `${t.materials.price} (${currency})`,
      align: "right",
      sortValue: (material) => Number(material.price),
      render: (material) => `${formatMoney(material.price, locale)} ${currency}`,
    },
    {
      key: "package",
      header: t.materials.packageSize,
      align: "right",
      sortValue: (material) => Number(material.package_size),
      render: (material) =>
        `${formatQuantity(material.package_size, locale)} ${t.domain.unit[material.unit]}`,
    },
    {
      key: "actions",
      header: t.common.actions,
      align: "right",
      render: (material) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing({ ...material });
              setFormErrors({});
            }}
          >
            {t.common.edit}
          </SecondaryButton>
          <DangerGhostButton type="button" onClick={() => setDeleting(material)}>
            {t.common.delete}
          </DangerGhostButton>
        </div>
      ),
    },
  ];

  return (
    <section aria-label={t.materials.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.materials.title}</h2>
        {materials.length > 0 ? (
          <PrimaryButton type="button" onClick={openNew}>
            {t.materials.newButton}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-ink-muted">{t.common.loading}</p>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={<LayersIcon />}
          message={t.materials.empty}
          action={
            <PrimaryButton type="button" onClick={openNew}>
              {t.materials.newButton}
            </PrimaryButton>
          }
        />
      ) : (
        <DataTable
          label={t.materials.title}
          rows={materials}
          columns={columns}
          rowKey={(material) => material.id}
          searchText={(material) =>
            [material.name, material.manufacturer, material.material_type, material.family]
              .filter(Boolean)
              .join(" ")
          }
        />
      )}

      {editing ? (
        <Modal
          title={materials.some((m) => m.id === editing.id) ? t.materials.editTitle : t.materials.newTitle}
          description={t.materials.formDescription}
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
            <FormSection title={t.materials.sectionMaterial}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-7">
                  <Field label={`${t.materials.name} *`} error={formErrors.name}>
                    <TextInput
                      autoFocus
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.name)}
                      value={editing.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder={t.materials.nameExample}
                    />
                  </Field>
                </div>
                <div className="md:col-span-5">
                  <Field label={`${t.materials.type} *`} error={formErrors.material_type}>
                    <TextInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.material_type)}
                      value={editing.material_type}
                      onChange={(e) => set("material_type", e.target.value)}
                      placeholder={t.materials.typeExample}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.materials.family}>
                    <Select
                      value={editing.family}
                      onChange={(v) => set("family", v as MaterialFamily)}
                      options={Object.entries(t.domain.family).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.materials.manufacturer}>
                    <TextInput
                      value={editing.manufacturer ?? ""}
                      onChange={(e) => set("manufacturer", e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={t.materials.sectionTechnical}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Field label={`${t.materials.density} *`} error={formErrors.density_g_cm3}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.density_g_cm3)}
                      value={editing.density_g_cm3}
                      onChange={(v) => set("density_g_cm3", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label={`${t.materials.packageSize} *`} error={formErrors.package_size}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.package_size)}
                      value={editing.package_size}
                      onChange={(v) => set("package_size", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
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
                </div>
              </div>
            </FormSection>

            <FormSection title={t.materials.sectionPrice}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Field label={`${t.materials.price} (${currency}) *`} error={formErrors.price}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.price)}
                      value={editing.price}
                      onChange={(v) => set("price", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-8">
                  <Field label={t.materials.shopLink}>
                    <TextInput
                      value={editing.shop_link ?? ""}
                      onChange={(e) => set("shop_link", e.target.value)}
                      placeholder="https://…"
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
