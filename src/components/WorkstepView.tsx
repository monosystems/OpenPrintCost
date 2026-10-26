import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, isDecimalString } from "../api/format";
import { useLocale, type Strings } from "../i18n";
import { useCurrencySymbol } from "../hooks/useCurrencySymbol";
import {
  newId,
  type Workstep,
  type WorkstepCalculationType,
  type WorkstepCategory,
  type WorkstepTiming,
} from "../api/types";
import { DataTable, type DataColumn } from "./DataTable";
import { WrenchIcon, XIcon } from "./icons";
import {
  ConfirmDialog,
  DangerGhostButton,
  DecimalInput,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
  IconButton,
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

function validate(workstep: Workstep, t: Strings): Errors {
  const errors: Errors = {};
  if (workstep.name.trim() === "") errors.name = t.validation.required(t.validation.designation);
  for (const [key, label] of [
    ["price", t.worksteps.price],
    ["quantity", t.worksteps.quantity],
    ["duration_hours", t.worksteps.duration],
  ] as const) {
    if (!isDecimalString(workstep[key])) {
      errors[key] = t.validation.decimal(label);
    }
  }
  return errors;
}

export function WorkstepView({ adapter }: { adapter: PlatformAdapter }) {
  const { t, locale } = useLocale();
  const currency = useCurrencySymbol(adapter);
  const [worksteps, setWorksteps] = useState<Workstep[]>([]);
  const [categories, setCategories] = useState<WorkstepCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Workstep | null>(null);
  const [deleting, setDeleting] = useState<Workstep | null>(null);
  const [formErrors, setFormErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
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
      setError(error instanceof Error ? error.message : t.errors.workstepsLoad);
    } finally {
      setLoading(false);
    }
  }, [adapter, t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openNew = () => {
    const first = categories[0];
    if (!first) {
      setError(t.errors.categoryRequired);
      return;
    }
    setEditing(emptyWorkstep(first));
    setFormErrors({});
  };

  const save = async () => {
    if (!editing) return;
    const errors = validate(editing, t);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSaving(true);
    try {
      await adapter.saveWorkstep({ ...editing, name: editing.name.trim() });
      setEditing(null);
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.workstepSave);
    } finally {
      setSaving(false);
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
      setError(error instanceof Error ? error.message : t.errors.workstepDelete);
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
      setError(error instanceof Error ? error.message : t.errors.categorySave);
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
      setError(error instanceof Error ? error.message : t.errors.categoryDelete);
    }
  };

  const set = <K extends keyof Workstep>(key: K, value: Workstep[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  const columns: ReadonlyArray<DataColumn<Workstep>> = [
    {
      key: "name",
      header: t.worksteps.name,
      sortValue: (workstep) => workstep.name,
      render: (workstep) => <p className="font-medium text-ink">{workstep.name}</p>,
    },
    {
      key: "category",
      header: t.worksteps.category,
      render: (workstep) => workstep.category.name,
    },
    {
      key: "type",
      header: t.worksteps.calculationType,
      render: (workstep) => (
        <span className="capitalize">
          {t.domain.calculationType[workstep.calculation_type]}
        </span>
      ),
    },
    {
      key: "price",
      header: `${t.worksteps.price} (${currency})`,
      align: "right",
      sortValue: (workstep) => Number(workstep.price),
      render: (workstep) => `${formatMoney(workstep.price, locale)} ${currency}`,
    },
    {
      key: "timing",
      header: t.worksteps.timing,
      render: (workstep) => (
        <span className="capitalize">{t.domain.timing[workstep.timing]}</span>
      ),
    },
    {
      key: "actions",
      header: t.common.actions,
      align: "right",
      render: (workstep) => (
        <div className="flex justify-end gap-2">
          <SecondaryButton
            type="button"
            onClick={() => {
              setEditing({ ...workstep, category: { ...workstep.category } });
              setFormErrors({});
            }}
          >
            {t.common.edit}
          </SecondaryButton>
          <DangerGhostButton type="button" onClick={() => setDeleting(workstep)}>
            {t.common.delete}
          </DangerGhostButton>
        </div>
      ),
    },
  ];

  return (
    <section aria-label={t.worksteps.title}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.worksteps.title}</h2>
        {worksteps.length > 0 ? (
          <PrimaryButton type="button" onClick={openNew}>
            {t.worksteps.newButton}
          </PrimaryButton>
        ) : null}
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <div className="mb-6 rounded-xl border border-line bg-surface p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">{t.worksteps.categories}</h3>
        {categories.length === 0 ? (
          <p className="mb-3 text-sm text-ink-faint">{t.worksteps.noCategories}</p>
        ) : (
          <ul className="mb-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-2 rounded-full border border-line-strong bg-raised px-3 py-1 text-sm text-ink"
              >
                {category.name}
                <IconButton
                  label={t.worksteps.deleteCategoryLabel(category.name)}
                  onClick={() => setDeletingCategory(category)}
                  danger
                  className="-mr-1 h-5 w-5"
                >
                  <XIcon className="h-3 w-3" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <TextInput
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder={t.worksteps.newCategoryPlaceholder}
            aria-label={t.worksteps.category}
          />
          <SecondaryButton type="button" onClick={() => void addCategory()}>
            {t.common.add}
          </SecondaryButton>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">{t.common.loading}</p>
      ) : worksteps.length === 0 ? (
        <EmptyState
          icon={<WrenchIcon />}
          message={t.worksteps.empty}
          action={
            <PrimaryButton type="button" onClick={openNew}>
              {t.worksteps.newButton}
            </PrimaryButton>
          }
        />
      ) : (
        <DataTable
          label={t.worksteps.title}
          rows={worksteps}
          columns={columns}
          rowKey={(workstep) => workstep.id}
          searchText={(workstep) =>
            [workstep.name, workstep.category.name, workstep.calculation_type]
              .filter(Boolean)
              .join(" ")
          }
        />
      )}

      {editing ? (
        <Modal
          title={worksteps.some((w) => w.id === editing.id) ? t.worksteps.editTitle : t.worksteps.newTitle}
          description={t.worksteps.formDescription}
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
            <FormSection title={t.worksteps.sectionGeneral}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-7">
                  <Field label={`${t.worksteps.name} *`} error={formErrors.name}>
                    <TextInput
                      autoFocus
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.name)}
                      value={editing.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder={t.worksteps.nameExample}
                    />
                  </Field>
                </div>
                <div className="md:col-span-5">
                  <Field label={t.worksteps.category}>
                    <Select
                      value={editing.category.id}
                      onChange={(id) => {
                        const found = categories.find((c) => c.id === id);
                        if (found) set("category", { ...found });
                      }}
                      options={categories.map((c) => ({ value: c.id, label: c.name }))}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection title={t.worksteps.sectionCalculation}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                <div className="md:col-span-6">
                  <Field label={t.worksteps.calculationType}>
                    <Select
                      value={editing.calculation_type}
                      onChange={(v) => set("calculation_type", v as WorkstepCalculationType)}
                      options={Object.entries(t.domain.calculationType).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
                <div className="md:col-span-6">
                  <Field label={t.worksteps.timing}>
                    <Select
                      value={editing.timing}
                      onChange={(v) => set("timing", v as WorkstepTiming)}
                      options={Object.entries(t.domain.timing).map(([value, label]) => ({ value, label }))}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label={`${t.worksteps.price} (${currency}) *`} error={formErrors.price}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.price)}
                      value={editing.price}
                      onChange={(v) => set("price", v)}
                    />
                  </Field>
                </div>
                <div className="md:col-span-4">
                  <Field label={`${t.worksteps.quantity} *`} error={formErrors.quantity}>
                    <DecimalInput
                      aria-required="true"
                      aria-invalid={Boolean(formErrors.quantity)}
                      value={editing.quantity}
                      onChange={(v) => set("quantity", v)}
                    />
                  </Field>
                </div>
                {editing.calculation_type === "per-hour" ? (
                  <div className="md:col-span-4">
                    <Field label={`${t.worksteps.duration} *`} error={formErrors.duration_hours}>
                      <DecimalInput
                        aria-required="true"
                        aria-invalid={Boolean(formErrors.duration_hours)}
                        value={editing.duration_hours}
                        onChange={(v) => set("duration_hours", v)}
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </FormSection>
          </div>
        </Modal>
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t.common.confirmTitle(t.worksteps.one)}
          message={t.common.confirmDeleteMessage(deleting.name)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {deletingCategory ? (
        <ConfirmDialog
          title={t.worksteps.deleteCategoryTitle}
          message={t.worksteps.deleteCategoryMessage(deletingCategory.name)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDeleteCategory()}
          onCancel={() => setDeletingCategory(null)}
        />
      ) : null}
    </section>
  );
}
