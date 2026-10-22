import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, formatQuantity, isDecimalString, labels } from "../api/format";
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

function validate(material: Material): Errors {
  const errors: Errors = {};
  if (material.name.trim() === "") errors.name = "Bitte eine Bezeichnung eingeben.";
  if (material.material_type.trim() === "") errors.material_type = "Bitte einen Typ eingeben (z. B. PLA).";
  for (const [key, label] of [
    ["density_g_cm3", "Dichte"],
    ["package_size", "Verpackungsgröße"],
    ["price", "Preis"],
  ] as const) {
    if (!isDecimalString(material[key])) {
      errors[key] = `${label}: bitte eine Zahl mit Punkt eingeben (z. B. 1.24).`;
    }
  }
  return errors;
}

export function MaterialView({ adapter }: { adapter: PlatformAdapter }) {
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
      setError(error instanceof Error ? error.message : "Materialien konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditing(emptyMaterial());
    setFormErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing);
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
      setError(error instanceof Error ? error.message : "Material konnte nicht gespeichert werden.");
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
      setError(error instanceof Error ? error.message : "Material konnte nicht gelöscht werden.");
    }
  };

  const set = <K extends keyof Material>(key: K, value: Material[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  return (
    <section aria-label="Materialien">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Materialien</h2>
        <PrimaryButton type="button" onClick={openNew}>
          Neues Material
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      {loading ? (
        <p className="text-sm text-slate-400">Wird geladen …</p>
      ) : materials.length === 0 ? (
        <EmptyState message="Noch keine Materialien angelegt. Lege dein erstes Filament, Harz oder Pulver an." />
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
                  {material.material_type} · {labels.family[material.family]} ·{" "}
                  {formatMoney(material.price)} € / {formatQuantity(material.package_size)}{" "}
                  {labels.unit[material.unit]}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton type="button" onClick={() => { setEditing({ ...material }); setFormErrors({}); }}>
                  Bearbeiten
                </SecondaryButton>
                <DangerButton type="button" onClick={() => setDeleting(material)}>
                  Löschen
                </DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal title={materials.some((m) => m.id === editing.id) ? "Material bearbeiten" : "Neues Material"} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Bezeichnung *" error={formErrors.name}>
              <TextInput value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="z. B. PETG Schwarz" />
            </Field>
            <Field label="Typ *" error={formErrors.material_type}>
              <TextInput value={editing.material_type} onChange={(e) => set("material_type", e.target.value)} placeholder="z. B. PETG" />
            </Field>
            <Field label="Materialfamilie">
              <Select
                value={editing.family}
                onChange={(v) => set("family", v as MaterialFamily)}
                options={Object.entries(labels.family).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label="Hersteller">
              <TextInput value={editing.manufacturer ?? ""} onChange={(e) => set("manufacturer", e.target.value)} />
            </Field>
            <Field label="Dichte (g/cm³) *" error={formErrors.density_g_cm3}>
              <DecimalInput value={editing.density_g_cm3} onChange={(v) => set("density_g_cm3", v)} />
            </Field>
            <Field label="Preis (€) *" error={formErrors.price}>
              <DecimalInput value={editing.price} onChange={(v) => set("price", v)} />
            </Field>
            <Field label="Verpackungsgröße *" error={formErrors.package_size}>
              <DecimalInput value={editing.package_size} onChange={(v) => set("package_size", v)} />
            </Field>
            <Field label="Einheit">
              <Select
                value={editing.unit}
                onChange={(v) => set("unit", v as MaterialUnit)}
                options={[
                  { value: "kg", label: "Kilogramm (kg)" },
                  { value: "g", label: "Gramm (g)" },
                  { value: "lb", label: "Pfund (lb)" },
                  { value: "oz", label: "Unze (oz)" },
                ]}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Shop-Link">
                <TextInput value={editing.shop_link ?? ""} onChange={(e) => set("shop_link", e.target.value)} placeholder="https://…" />
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <SecondaryButton type="button" onClick={() => setEditing(null)}>
              Abbrechen
            </SecondaryButton>
            <PrimaryButton type="button" onClick={() => void save()}>
              Speichern
            </PrimaryButton>
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Material löschen"
          message={`„${deleting.name}“ wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`}
          confirmLabel="Löschen"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
