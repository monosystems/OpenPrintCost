import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, isDecimalString, labels } from "../api/format";
import { de } from "../i18n/de";
import {
  newId,
  type Workstep,
  type WorkstepCalculationType,
  type WorkstepCategory,
  type WorkstepTiming,
} from "../api/types";
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

function emptyWorkstep(category: WorkstepCategory): Workstep {
  return {
    id: newId(),
    name: "",
    category: { ...category },
    calculation_type: "per-piece",
    price: "0",
    quantity: "1",
    duration_hours: "0",
    timing: "other",
  };
}

type Errors = Partial<Record<string, string>>;

function validate(workstep: Workstep): Errors {
  const errors: Errors = {};
  if (workstep.name.trim() === "") errors.name = de.validation.required(de.validation.designation);
  for (const [key, label] of [
    ["price", de.worksteps.price],
    ["quantity", de.worksteps.quantity],
    ["duration_hours", de.worksteps.duration],
  ] as const) {
    if (!isDecimalString(workstep[key])) {
      errors[key] = de.validation.decimal(label);
    }
  }
  return errors;
}

export function WorkstepView({ adapter }: { adapter: PlatformAdapter }) {
  const [worksteps, setWorksteps] = useState<Workstep[]>([]);
  const [categories, setCategories] = useState<WorkstepCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Workstep | null>(null);
  const [deleting, setDeleting] = useState<Workstep | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [newCategory, setNewCategory] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<WorkstepCategory | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedSteps, loadedCategories] = await Promise.all([
        adapter.listWorksteps(),
        adapter.listWorkstepCategories(),
      ]);
      setWorksteps(loadedSteps);
      setCategories(loadedCategories);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : de.errors.workstepsLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    const first = categories[0];
    if (!first) {
      setError(de.errors.categoryRequired);
      return;
    }
    setEditing(emptyWorkstep(first));
    setFormErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    try {
      await adapter.saveWorkstep({ ...editing, name: editing.name.trim() });
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : de.errors.workstepSave);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await adapter.deleteWorkstep(deleting.id);
      setDeleting(null);
      await reload();
    } catch (error) {
      setDeleting(null);
      setError(error instanceof Error ? error.message : de.errors.workstepDelete);
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (name === "") return;
    try {
      await adapter.saveWorkstepCategory({ id: newId(), name, color: null });
      setNewCategory("");
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : de.errors.categorySave);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      await adapter.deleteWorkstepCategory(deletingCategory.id);
      setDeletingCategory(null);
      await reload();
    } catch (error) {
      setDeletingCategory(null);
      setError(error instanceof Error ? error.message : de.errors.categoryDelete);
    }
  };

  const set = <K extends keyof Workstep>(key: K, value: Workstep[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  return (
    <section aria-label={de.worksteps.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">{de.worksteps.title}</h2>
        <PrimaryButton type="button" onClick={openNew}>
          {de.worksteps.newButton}
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">{de.worksteps.categories}</h3>
        {categories.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">{de.worksteps.noCategories}</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200"
              >
                {category.name}
                <button
                  type="button"
                  onClick={() => setDeletingCategory(category)}
                  aria-label={de.worksteps.deleteCategoryLabel(category.name)}
                  className="rounded px-1 text-slate-400 hover:bg-slate-700 hover:text-red-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <TextInput
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder={de.worksteps.newCategoryPlaceholder}
            aria-label={de.worksteps.category}
          />
          <SecondaryButton type="button" onClick={() => void addCategory()}>
            {de.common.add}
          </SecondaryButton>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">{de.common.loading}</p>
      ) : worksteps.length === 0 ? (
        <EmptyState message={de.worksteps.empty} />
      ) : (
        <ul className="space-y-2">
          {worksteps.map((workstep) => (
            <li
              key={workstep.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{workstep.name}</p>
                <p className="text-xs text-slate-400">
                  {workstep.category.name} · {labels.calculationType[workstep.calculation_type]} ·{" "}
                  {formatMoney(workstep.price)} €
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <SecondaryButton type="button" onClick={() => { setEditing({ ...workstep, category: { ...workstep.category } }); setFormErrors({}); }}>
                  {de.common.edit}
                </SecondaryButton>
                <DangerButton type="button" onClick={() => setDeleting(workstep)}>
                  {de.common.delete}
                </DangerButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <Modal title={worksteps.some((w) => w.id === editing.id) ? de.worksteps.editTitle : de.worksteps.newTitle} onClose={() => setEditing(null)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label={`${de.worksteps.name} *`} error={formErrors.name}>
                <TextInput value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder={de.worksteps.nameExample} />
              </Field>
            </div>
            <Field label={de.worksteps.category}>
              <Select
                value={editing.category.id}
                onChange={(id) => {
                  const found = categories.find((c) => c.id === id);
                  if (found) set("category", { ...found });
                }}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Field>
            <Field label={de.worksteps.calculationType}>
              <Select
                value={editing.calculation_type}
                onChange={(v) => set("calculation_type", v as WorkstepCalculationType)}
                options={Object.entries(labels.calculationType).map(([value, label]) => ({ value, label }))}
              />
            </Field>
            <Field label={`${de.worksteps.price} (€) *`} error={formErrors.price}>
              <DecimalInput value={editing.price} onChange={(v) => set("price", v)} />
            </Field>
            <Field label={`${de.worksteps.quantity} *`} error={formErrors.quantity}>
              <DecimalInput value={editing.quantity} onChange={(v) => set("quantity", v)} />
            </Field>
            {editing.calculation_type === "per-hour" ? (
              <Field label={`${de.worksteps.duration} (Stunden) *`} error={formErrors.duration_hours}>
                <DecimalInput value={editing.duration_hours} onChange={(v) => set("duration_hours", v)} />
              </Field>
            ) : null}
            <Field label={de.worksteps.timing}>
              <Select
                value={editing.timing}
                onChange={(v) => set("timing", v as WorkstepTiming)}
                options={Object.entries(labels.timing).map(([value, label]) => ({ value, label }))}
              />
            </Field>
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
          title={de.common.confirmTitle(de.worksteps.one)}
          message={de.common.confirmDeleteMessage(deleting.name)}
          confirmLabel={de.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {deletingCategory ? (
        <ConfirmDialog
          title={de.worksteps.deleteCategoryTitle}
          message={de.worksteps.deleteCategoryMessage(deletingCategory.name)}
          confirmLabel={de.common.delete}
          onConfirm={() => void confirmDeleteCategory()}
          onCancel={() => setDeletingCategory(null)}
        />
      ) : null}
    </section>
  );
}
