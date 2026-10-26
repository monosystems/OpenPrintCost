import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { PlatformAdapter } from "../api/platform";
import { currencySymbol } from "../api/currency";
import { formatMoney, isDecimalString } from "../api/format";
import { checkPrintability } from "../api/printability";
import { useLocale, useStrings, type Strings } from "../i18n";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  emptyCompany,
  newId,
  type AdditionalItem,
  type CalculationFileInput,
  type CalculationInput,
  type CalculationProfile,
  type CalculationResult,
  type CalculationSummary,
  type CompanyInfo,
  type CustomSurcharge,
  type DimensionsMm,
  type HourlyRate,
  type Material,
  type Printer,
  type SurchargeTiming,
  type Workstep,
} from "../api/types";
import { CalculationResultView } from "./CalculationResultView";
import { CompactSummary, ResultPanel } from "./ResultPanel";
import {
  CalculatorIcon,
  ChevronDownIcon,
  LayersIcon,
  PlusIcon,
  PrinterIcon,
  XIcon,
} from "./icons";
import {
  Checkbox,
  ConfirmDialog,
  DecimalInput,
  EmptyState,
  ErrorBanner,
  Field,
  FormSection,
  GhostButton,
  IconButton,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
  Toast,
} from "./ui";

type CalculationTarget = "printers" | "materials";

/** Sentinel for the built-in default profile in the profile select. */
const STANDARD_PROFILE = "__standard";

type CalculationHint =
  | { kind: "import"; slicer: string; source: "comments" | "simulated" }
  | { kind: "fileTime" }
  | { kind: "triangles"; count: number }
  | { kind: "exportSaved"; path: string }
  | { kind: "exportCancelled" }
  | { kind: "importCancelled" }
  | { kind: "jsonSaved"; path: string }
  | { kind: "jsonImported"; name: string };

function hintText(hint: CalculationHint, t: Strings): string {
  switch (hint.kind) {
    case "import":
      return t.calculation.importTaken(
        hint.slicer,
        hint.source === "comments" ? t.calculation.commentTime : t.calculation.simulatedTime,
      );
    case "fileTime":
      return t.calculation.fileTimeTaken;
    case "triangles":
      return t.calculation.trianglesTaken(hint.count);
    case "exportSaved":
      return t.calculation.exportSaved(hint.path);
    case "exportCancelled":
      return t.calculation.exportCancelled;
    case "importCancelled":
      return t.calculation.importCancelled;
    case "jsonSaved":
      return t.calculation.jsonSaved(hint.path);
    case "jsonImported":
      return t.calculation.jsonImported(hint.name);
  }
}

function defaultProfile(t: Strings): CalculationProfile {
  return {
    id: newId(),
    name: t.profiles.standard,
    fail_rate_percent: "0",
    tax_rate_percent: "19",
    margin_percent: "0",
    handling_fee: "0",
    handling_fee_scope: "once",
    energy_price_per_kwh: "0.35",
    apply_energy_costs: false,
    power_level_percent: "100",
    combine_materials: false,
    multiply_print_time_with_quantity: true,
    print_time_factor: "1",
    exclude_machine_from_margin: false,
    exclude_material_from_margin: false,
    exclude_worksteps_from_margin: false,
  };
}

function emptyFile(): CalculationFileInput {
  return {
    id: newId(),
    file_name: "",
    quantity: 1,
    print_time_hours: "0",
    volume_cm3: null,
    dimensions_mm: null,
    weight_g: null,
    materials: [],
    material_changes: 0,
    multiply_print_time_with_quantity: null,
  };
}

function emptyCalculation(
  printer: Printer,
  t: Strings,
  profile?: CalculationProfile,
): CalculationInput {
  return {
    id: newId(),
    project_name: "",
    notes: null,
    created_at: null,
    printer: { ...printer },
    profile: profile ? structuredClone(profile) : defaultProfile(t),
    hourly_rate: null,
    worksteps: [],
    additional_items: [],
    custom_surcharges: [],
    files: [],
  };
}

const emptyDecimal = (value: string | null) => value ?? "";

export function CalculationView({
  adapter,
  active = true,
  onNavigate,
}: {
  adapter: PlatformAdapter;
  /** Re-load master data when the tab becomes visible again. */
  active?: boolean;
  onNavigate?: (tab: CalculationTarget) => void;
}) {
  const { t, locale } = useLocale();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allWorksteps, setAllWorksteps] = useState<Workstep[]>([]);
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [profiles, setProfiles] = useState<CalculationProfile[]>([]);
  const [saved, setSaved] = useState<CalculationSummary[]>([]);
  const [current, setCurrent] = useState<CalculationInput | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingSaved, setDeletingSaved] = useState<CalculationSummary | null>(null);
  const [hint, setHint] = useState<CalculationHint | null>(null);
  const [company, setCompany] = useState<CompanyInfo>(emptyCompany);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [transferring, setTransferring] = useState<"import" | "export" | null>(null);
  const [baseLoading, setBaseLoading] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const currency = currencySymbol(company.currency);
  const isWide = useMediaQuery("(min-width: 1280px)");
  const resultRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const reloadBase = useCallback(async () => {
    try {
      const [p, m, w, r, pr, s, c] = await Promise.all([
        adapter.listPrinters(),
        adapter.listMaterials(),
        adapter.listWorksteps(),
        adapter.listHourlyRates(),
        adapter.listCalculationProfiles(),
        adapter.listCalculations(),
        adapter.getCompanyInfo().catch(() => emptyCompany),
      ]);
      setPrinters(p);
      setMaterials(m);
      setAllWorksteps(w);
      setRates(r);
      setProfiles(pr);
      setSaved(s);
      setCompany(c);
    } catch (error) {
      setError(error instanceof Error ? error.message : t.errors.baseLoad);
    } finally {
      setBaseLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    if (active) void reloadBase();
  }, [active, reloadBase]);

  useEffect(() => {
    if (!result || isWide) return;
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    resultRef.current?.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [result, isWide]);

  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [error]);

  const fail = (message: string) => setError(message);
  const update = (patch: Partial<CalculationInput>) => {
    const affectsCost = Object.keys(patch).some((key) => key !== "notes");
    if (affectsCost) setResult(null);
    setDirty(true);
    setCurrent((current) => (current ? { ...current, ...patch } : current));
  };

  const createNewCalculation = () => {
    if (printers.length === 0) {
      fail(t.errors.printerRequired);
      return;
    }
    const first = printers[0];
    if (!first) return;
    setCurrent(emptyCalculation(first, t, profiles[0]));
    setResult(null);
    setProfileOpen(false);
    setDirty(false);
    setConfirmNew(false);
  };

  const requestNewCalculation = () => {
    if (current && dirty) {
      setConfirmNew(true);
      return;
    }
    createNewCalculation();
  };

  const loadSaved = async (id: string) => {
    try {
      const stored = await adapter.getCalculation(id);
      setCurrent(structuredClone(stored.document));
      setResult(null);
      setProfileOpen(false);
      setDirty(false);
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : t.errors.calculationLoad);
    }
  };

  const confirmDeleteSaved = async () => {
    if (!deletingSaved) return;
    try {
      await adapter.deleteCalculation(deletingSaved.id);
      setDeletingSaved(null);
      const list = await adapter.listCalculations();
      setSaved(list);
    } catch (error) {
      setDeletingSaved(null);
      fail(error instanceof Error ? error.message : t.errors.calculationDelete);
    }
  };

  const calculate = async () => {
    if (!current || calculating) return;
    if (current.project_name.trim() === "") {
      fail(t.errors.projectRequired);
      return;
    }
    if (current.files.length === 0) {
      fail(t.errors.fileRequired);
      return;
    }
    setCalculating(true);
    try {
      setResult(await adapter.calculate(current));
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : t.errors.calculate);
    } finally {
      setCalculating(false);
    }
  };

  const save = async () => {
    if (!current || saving) return;
    if (current.project_name.trim() === "") {
      fail(t.errors.projectRequired);
      return;
    }
    setSaving(true);
    try {
      await adapter.saveCalculation(current);
      setSaved(await adapter.listCalculations());
      setDirty(false);
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : t.errors.calculationSave);
    } finally {
      setSaving(false);
    }
  };

  const exportFile = async (kind: "pdf" | "xlsx") => {
    if (!result || exporting) return;
    setExporting(kind);
    try {
      const path =
        kind === "pdf"
          ? await adapter.exportResultPdf(result, company)
          : await adapter.exportResultExcel(result, company);
      setHint(path ? { kind: "exportSaved", path } : { kind: "exportCancelled" });
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : t.errors.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const exportJson = async () => {
    if (!current || transferring) return;
    setTransferring("export");
    try {
      const path = await adapter.exportCalculationJson(current);
      setHint(path ? { kind: "jsonSaved", path } : { kind: "exportCancelled" });
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : t.errors.calculationExport);
    } finally {
      setTransferring(null);
    }
  };

  const importJson = async () => {
    if (transferring) return;
    setTransferring("import");
    try {
      const document = await adapter.importCalculationFile();
      if (!document) {
        setConfirmImport(false);
        setHint({ kind: "importCancelled" });
        return;
      }
      setCurrent(structuredClone(document));
      setResult(null);
      setProfileOpen(false);
      setConfirmImport(false);
      setDirty(true);
      setError(null);
      setHint({ kind: "jsonImported", name: document.project_name });
    } catch (error) {
      setConfirmImport(false);
      fail(error instanceof Error ? error.message : t.errors.calculationImport);
    } finally {
      setTransferring(null);
    }
  };

  const requestImport = () => {
    if (current && dirty) {
      setConfirmImport(true);
      return;
    }
    void importJson();
  };

  const updateFile = (fileId: string, patch: Partial<CalculationFileInput>) => {
    setResult(null);
    setDirty(true);
    setCurrent((current) =>
      current
        ? { ...current, files: current.files.map((f) => (f.id === fileId ? { ...f, ...patch } : f)) }
        : current,
    );
  };

  const removeFile = (fileId: string) => {
    setResult(null);
    setDirty(true);
    setCurrent((current) =>
      current ? { ...current, files: current.files.filter((f) => f.id !== fileId) } : current,
    );
  };

  const addMaterialToFile = (fileId: string, materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;
    setResult(null);
    setDirty(true);
    setCurrent((current) =>
      current
        ? {
            ...current,
            files: current.files.map((f) =>
              f.id === fileId
                ? { ...f, materials: [...f.materials, { material: { ...material }, weight_g: null }] }
                : f,
            ),
          }
        : current,
    );
  };

  const importIntoFile = async (fileId: string, kind: "gcode" | "stl") => {
    try {
      const path = await adapter.pickImportFile(kind);
      const info =
        kind === "gcode"
          ? await adapter.importGcodeFile(path ?? "demo")
          : await adapter.importStlFile(path ?? "demo");
      if (kind === "gcode" && "used_comments" in info) {
        const time = info.time_from_comments_hours ?? info.simulated_time_hours;
        updateFile(fileId, { print_time_hours: time });
        setHint(
          info.detected_slicer
            ? {
                kind: "import",
                slicer: info.detected_slicer,
                source: info.used_comments ? "comments" : "simulated",
              }
            : { kind: "fileTime" },
        );
      } else if (kind === "stl" && "volume_cm3" in info) {
        updateFile(fileId, {
          volume_cm3: info.volume_cm3,
          dimensions_mm: info.dimensions_mm,
        });
        setHint({ kind: "triangles", count: info.triangle_count });
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : t.errors.importFailed);
    }
  };

  const toggleWorkstep = (workstep: Workstep) => {
    setResult(null);
    setDirty(true);
    setCurrent((current) => {
      if (!current) return current;
      const selected = current.worksteps.some((w) => w.id === workstep.id);
      return {
        ...current,
        worksteps: selected
          ? current.worksteps.filter((w) => w.id !== workstep.id)
          : [...current.worksteps, { ...workstep, category: { ...workstep.category } }],
      };
    });
  };

  const updateProfile = (patch: Partial<CalculationProfile>) => {
    setResult(null);
    setDirty(true);
    setCurrent((current) =>
      current ? { ...current, profile: { ...current.profile, ...patch } } : current,
    );
  };

  const selectProfile = (id: string) => {
    if (id === STANDARD_PROFILE) {
      updateProfile(defaultProfile(t));
      return;
    }
    const found = profiles.find((profile) => profile.id === id);
    if (found) updateProfile(structuredClone(found));
  };

  const showDetails = () => {
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    resultRef.current?.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const dismissHint = useCallback(() => setHint(null), []);

  return (
    <section aria-label={t.calculation.title} aria-busy={calculating}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.calculation.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton
            type="button"
            onClick={requestImport}
            loading={transferring === "import"}
          >
            {t.calculation.importJson}
          </SecondaryButton>
          {current ? (
            <SecondaryButton
              type="button"
              onClick={() => void exportJson()}
              loading={transferring === "export"}
            >
              {t.calculation.exportJson}
            </SecondaryButton>
          ) : null}
          {current ? (
            <SecondaryButton type="button" onClick={requestNewCalculation}>
              {t.calculation.newButton}
            </SecondaryButton>
          ) : null}
        </div>
      </div>

      {error ? (
        <div ref={errorRef} className="scroll-mt-24">
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      ) : null}

      {saved.length > 0 ? (
        <div className="mb-6 rounded-card border border-line bg-surface p-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t.calculation.savedTitle}
          </h3>
          <ul className="divide-y divide-line">
            {saved.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <button
                  type="button"
                  onClick={() => void loadSaved(entry.id)}
                  className="min-w-0 flex-1 truncate rounded-control px-1 py-0.5 text-left text-brand-ink transition-colors hover:bg-raised/40 hover:text-ink"
                >
                  {entry.project_name}
                  <span className="ml-2 text-xs text-ink-faint">
                    {t.calculation.savedMeta(entry.file_count, entry.total_quantity)}
                  </span>
                </button>
                <IconButton
                  label={t.calculation.deleteSavedLabel(entry.project_name)}
                  onClick={() => setDeletingSaved(entry)}
                  danger
                >
                  <XIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!current ? (
        baseLoading ? (
          <EmptyState message={t.common.loading} />
        ) : printers.length === 0 ? (
          <SetupChecklist onNavigate={onNavigate} />
        ) : (
          <EmptyState
            icon={<CalculatorIcon />}
            title={t.calculation.emptyTitle}
            description={t.calculation.empty}
            action={
              <PrimaryButton type="button" onClick={requestNewCalculation}>
                {t.calculation.newButton}
              </PrimaryButton>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            {!isWide ? (
              <CompactSummary
                result={result}
                currency={currency}
                calculating={calculating}
                saving={saving}
                onCalculate={() => void calculate()}
                onSave={() => void save()}
              />
            ) : null}
            <div className="space-y-6">
              <FormSection title={t.calculation.sectionProject}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  <div className="md:col-span-7">
                    <Field label={`${t.calculation.projectName} *`}>
                      <TextInput
                        value={current.project_name}
                        onChange={(e) => update({ project_name: e.target.value })}
                        placeholder={t.calculation.projectExample}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-5">
                    <Field label={t.calculation.notes}>
                      <TextInput
                        value={current.notes ?? ""}
                        onChange={(e) => update({ notes: e.target.value ? e.target.value : null })}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-6">
                    <Field label={t.calculation.printer}>
                      <Select
                        value={current.printer.id}
                        onChange={(id) => {
                          const found = printers.find((p) => p.id === id);
                          if (found) update({ printer: { ...found } });
                        }}
                        options={printers.map((p) => ({ value: p.id, label: p.model }))}
                      />
                    </Field>
                  </div>
                  <div className="md:col-span-6">
                    <Field label={t.calculation.hourlyRate}>
                      <Select
                        value={current.hourly_rate?.id ?? ""}
                        onChange={(id) => {
                          const found = rates.find((r) => r.id === id);
                          update({ hourly_rate: found ? { ...found } : null });
                        }}
                        options={[
                          { value: "", label: t.calculation.hourlyRateNone },
                          ...rates.map((r) => ({ value: r.id, label: r.name })),
                        ]}
                      />
                    </Field>
                  </div>
                </div>
              </FormSection>

              <ProfileSection
                profile={current.profile}
                profiles={profiles}
                currency={currency}
                open={profileOpen}
                onToggle={() => setProfileOpen((open) => !open)}
                onSelect={selectProfile}
                onChange={updateProfile}
              />

              <FormSection
                title={t.calculation.filesTitle}
                action={
                  <SecondaryButton
                    type="button"
                    onClick={() => update({ files: [...current.files, emptyFile()] })}
                  >
                    <PlusIcon />
                    {t.calculation.addFile}
                  </SecondaryButton>
                }
              >
                {current.files.length === 0 ? (
                  <EmptyState message={t.calculation.noFiles} />
                ) : (
                  <ul className="space-y-3">
                    {current.files.map((file) => (
                      <FileCard
                        key={file.id}
                        file={file}
                        currency={currency}
                        printer={current.printer}
                        materials={materials}
                        onChange={(patch) => updateFile(file.id, patch)}
                        onRemove={() => removeFile(file.id)}
                        onAddMaterial={(materialId) => addMaterialToFile(file.id, materialId)}
                        onRemoveMaterial={(index) =>
                          updateFile(file.id, {
                            materials: file.materials.filter((_, i) => i !== index),
                          })
                        }
                        onImport={(kind) => void importIntoFile(file.id, kind)}
                      />
                    ))}
                  </ul>
                )}
              </FormSection>

              <FormSection title={t.calculation.workstepsTitle}>
                {allWorksteps.length === 0 ? (
                  <p className="text-sm text-ink-faint">{t.worksteps.noneAvailable}</p>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
                    {allWorksteps.map((workstep) => {
                      const selected = current.worksteps.some((w) => w.id === workstep.id);
                      return (
                        <li key={workstep.id} className="px-4 py-2.5">
                          <Checkbox
                            checked={selected}
                            onChange={() => toggleWorkstep(workstep)}
                            label={
                              <>
                                {workstep.name}
                                <span className="ml-2 text-xs text-ink-faint">
                                  ({formatMoney(workstep.price, locale)} {currency})
                                </span>
                              </>
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </FormSection>

              <ItemEditor
                items={current.additional_items}
                files={current.files}
                currency={currency}
                onChange={(items) => update({ additional_items: items })}
              />
              <SurchargeEditor
                surcharges={current.custom_surcharges}
                onChange={(surcharges) => update({ custom_surcharges: surcharges })}
              />
            </div>
          </div>

          {isWide ? (
            <div className="min-w-0">
              <div className="xl:sticky xl:top-6">
                <ResultPanel
                  result={result}
                  currency={currency}
                  calculating={calculating}
                  saving={saving}
                  onCalculate={() => void calculate()}
                  onSave={() => void save()}
                  onShowDetails={showDetails}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}

      {current && result ? (
        <div ref={resultRef} className="scroll-mt-24">
          <CalculationResultView
            result={result}
            files={current.files}
            currency={currency}
            onExportPdf={() => void exportFile("pdf")}
            onExportExcel={() => void exportFile("xlsx")}
            exporting={exporting}
          />
        </div>
      ) : null}

      {deletingSaved ? (
        <ConfirmDialog
          title={t.common.confirmTitle(t.calculation.one)}
          message={t.common.confirmDeleteMessage(deletingSaved.project_name)}
          confirmLabel={t.common.delete}
          onConfirm={() => void confirmDeleteSaved()}
          onCancel={() => setDeletingSaved(null)}
        />
      ) : null}

      {confirmImport ? (
        <ConfirmDialog
          title={t.calculation.importConfirmTitle}
          message={t.calculation.importConfirmMessage}
          confirmLabel={t.calculation.importConfirm}
          onConfirm={() => void importJson()}
          onCancel={() => setConfirmImport(false)}
        />
      ) : null}

      {confirmNew ? (
        <ConfirmDialog
          title={t.calculation.discardTitle}
          message={t.calculation.discardMessage}
          confirmLabel={t.calculation.discardConfirm}
          onConfirm={createNewCalculation}
          onCancel={() => setConfirmNew(false)}
        />
      ) : null}

      {hint ? (
        <Toast
          message={hintText(hint, t)}
          tone={
            hint.kind === "exportCancelled" || hint.kind === "importCancelled"
              ? "warning"
              : hint.kind === "exportSaved" ||
                  hint.kind === "jsonSaved" ||
                  hint.kind === "jsonImported"
                ? "success"
                : "info"
          }
          onDismiss={dismissHint}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// First-run setup
// ---------------------------------------------------------------------------

function SetupChecklist({ onNavigate }: { onNavigate?: (tab: CalculationTarget) => void }) {
  const t = useStrings();
  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-brand-soft text-brand-ink">
          <CalculatorIcon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink">{t.calculation.setupTitle}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">{t.calculation.setupHint}</p>
        </div>
      </div>
      <ol className="space-y-3">
        <SetupStep
          icon={<PrinterIcon />}
          title={t.calculation.setupStepPrinter}
          hint={t.calculation.setupPrinterHint}
          action={
            <PrimaryButton type="button" onClick={() => onNavigate?.("printers")}>
              {t.calculation.setupPrinter}
            </PrimaryButton>
          }
        />
        <SetupStep
          icon={<LayersIcon />}
          title={t.calculation.setupStepMaterial}
          hint={t.calculation.setupMaterialHint}
          action={
            <SecondaryButton type="button" onClick={() => onNavigate?.("materials")}>
              {t.calculation.setupMaterial}
            </SecondaryButton>
          }
        />
        <SetupStep
          icon={<CalculatorIcon />}
          title={t.calculation.setupStepCalculation}
          hint={t.calculation.setupCalculationHint}
          muted
        />
      </ol>
    </div>
  );
}

function SetupStep({
  icon,
  title,
  hint,
  action,
  muted = false,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  action?: ReactNode;
  muted?: boolean;
}) {
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-control border border-line bg-canvas/40 px-3 py-3 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-raised text-ink-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-faint">{hint}</p>
      </div>
      {action}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Profile (inline — managing named profiles lives here for now)
// ---------------------------------------------------------------------------

function ProfileSection({
  profile,
  profiles,
  currency,
  open,
  onToggle,
  onSelect,
  onChange,
}: {
  profile: CalculationProfile;
  profiles: CalculationProfile[];
  currency: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onChange: (patch: Partial<CalculationProfile>) => void;
}) {
  const t = useStrings();
  const isSaved = profiles.some((entry) => entry.id === profile.id);
  const saved = profiles.find((entry) => entry.id === profile.id);
  const adjusted =
    saved !== undefined &&
    (Object.keys(saved) as (keyof CalculationProfile)[]).some(
      (key) => saved[key] !== profile[key],
    );
  const options = [
    ...(isSaved
      ? [{ value: STANDARD_PROFILE, label: t.profiles.standard }]
      : []),
    ...profiles.map((entry) => ({ value: entry.id, label: entry.name })),
    ...(isSaved ? [] : [{ value: profile.id, label: profile.name }]),
  ];

  return (
    <FormSection
      title={t.calculation.profileLegend}
      action={
        <div className="flex flex-wrap items-center gap-2">
          {adjusted ? (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
              {t.calculation.profileAdjusted}
            </span>
          ) : null}
          <GhostButton type="button" onClick={onToggle}>
            <ChevronDownIcon
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
            {open ? t.calculation.profileHide : t.calculation.profileEdit}
          </GhostButton>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
        <div className="md:col-span-5">
          <Field label={t.calculation.profileSelect}>
            <Select value={profile.id} onChange={onSelect} options={options} />
          </Field>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-control border border-line bg-field md:col-span-7">
          <div className="px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {t.calculation.profileTax}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
              {profile.tax_rate_percent} %
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {t.calculation.profileMargin}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
              {profile.margin_percent} %
            </dd>
          </div>
          <div className="px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              {t.calculation.profileFailRate}
            </dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-ink">
              {profile.fail_rate_percent} %
            </dd>
          </div>
        </dl>
      </div>

      {open ? (
        <div className="mt-6 border-t border-line pt-6">
          <ProfileForm profile={profile} currency={currency} onChange={onChange} />
        </div>
      ) : null}
    </FormSection>
  );
}

function ProfileForm({
  profile,
  currency,
  onChange,
}: {
  profile: CalculationProfile;
  currency: string;
  onChange: (patch: Partial<CalculationProfile>) => void;
}) {
  const t = useStrings();
  const set = (key: keyof CalculationProfile, value: string | boolean) =>
    onChange({ [key]: value } as Partial<CalculationProfile>);
  const num = (
    label: string,
    key: "fail_rate_percent" | "tax_rate_percent" | "margin_percent" | "handling_fee" | "energy_price_per_kwh" | "power_level_percent" | "print_time_factor",
  ) => (
    <div className="md:col-span-4">
      <Field label={label}>
        <DecimalInput value={profile[key]} onChange={(v) => set(key, v)} />
      </Field>
    </div>
  );
  const check = (label: string, key: "apply_energy_costs" | "combine_materials" | "multiply_print_time_with_quantity" | "exclude_machine_from_margin" | "exclude_material_from_margin" | "exclude_worksteps_from_margin") => (
    <Checkbox
      checked={profile[key]}
      onChange={(checked) => set(key, checked)}
      label={label}
    />
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        {num(t.profiles.failRate, "fail_rate_percent")}
        {num(t.profiles.tax, "tax_rate_percent")}
        {num(t.profiles.margin, "margin_percent")}
        {num(`${t.profiles.handlingFee} (${currency})`, "handling_fee")}
        {num(`${t.profiles.energyPrice} (${currency}/kWh)`, "energy_price_per_kwh")}
        {num(t.profiles.powerLevel, "power_level_percent")}
        {num(t.profiles.printTimeFactor, "print_time_factor")}
        <div className="md:col-span-4">
          <Field label={t.profiles.handlingScope}>
            <Select
              value={profile.handling_fee_scope}
              onChange={(v) => onChange({ handling_fee_scope: v as "per-file" | "once" })}
              options={[
                { value: "once", label: t.profiles.once },
                { value: "per-file", label: t.profiles.perFile },
              ]}
            />
          </Field>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {check(t.profiles.applyEnergy, "apply_energy_costs")}
        {check(t.profiles.combine, "combine_materials")}
        {check(t.profiles.multiplyTime, "multiply_print_time_with_quantity")}
        {check(t.profiles.excludeMachine, "exclude_machine_from_margin")}
        {check(t.profiles.excludeMaterial, "exclude_material_from_margin")}
        {check(t.profiles.excludeWorksteps, "exclude_worksteps_from_margin")}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File card
// ---------------------------------------------------------------------------

function FileCard({
  file,
  currency,
  printer,
  materials,
  onChange,
  onRemove,
  onAddMaterial,
  onRemoveMaterial,
  onImport,
}: {
  file: CalculationFileInput;
  currency: string;
  printer: Printer;
  materials: Material[];
  onChange: (patch: Partial<CalculationFileInput>) => void;
  onRemove: () => void;
  onAddMaterial: (materialId: string) => void;
  onRemoveMaterial: (index: number) => void;
  onImport: (kind: "gcode" | "stl") => void;
}) {
  const t = useStrings();
  const { locale } = useLocale();
  const [materialPick, setMaterialPick] = useState("");
  const num = (value: string | null) => emptyDecimal(value);
  const printability = checkPrintability(file.dimensions_mm, printer);
  const setDimension = (index: 0 | 1 | 2, value: string) => {
    const next: DimensionsMm = file.dimensions_mm
      ? [...file.dimensions_mm]
      : ["0", "0", "0"];
    next[index] = value === "" ? "0" : value;
    const hasValue = next.some((dimension) => Number(dimension) > 0);
    onChange({ dimensions_mm: hasValue ? next : null });
  };

  return (
    <li className="rounded-card border border-line bg-surface p-4">
      <div className="mb-4 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label={t.calculation.fileNameAria}>
            <TextInput
              value={file.file_name}
              onChange={(e) => onChange({ file_name: e.target.value })}
              placeholder={t.calculation.fileNamePlaceholder}
              aria-label={t.calculation.fileNameAria}
            />
          </Field>
        </div>
        <IconButton
          label={t.calculation.removeFileLabel(file.file_name || t.calculation.unnamedFile)}
          onClick={onRemove}
          danger
          className="mb-0.5"
        >
          <XIcon />
        </IconButton>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <Field label={t.calculation.quantity}>
            <TextInput
              value={String(file.quantity)}
              inputMode="numeric"
              className="text-right tabular-nums"
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange({ quantity: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 });
              }}
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field label={t.calculation.printTime}>
            <DecimalInput value={file.print_time_hours} onChange={(v) => onChange({ print_time_hours: v })} />
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field label={t.calculation.volume}>
            <DecimalInput value={num(file.volume_cm3)} onChange={(v) => onChange({ volume_cm3: v ? v : null })} />
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field label={t.calculation.weight}>
            <DecimalInput value={num(file.weight_g)} onChange={(v) => onChange({ weight_g: v ? v : null })} />
          </Field>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {t.calculation.dimensions}
          </h4>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          {(["x", "y", "z"] as const).map((axis, index) => (
            <div key={axis} className="md:col-span-3">
              <Field
                label={
                  axis === "x"
                    ? t.calculation.axisX
                    : axis === "y"
                      ? t.calculation.axisY
                      : t.calculation.axisZ
                }
              >
                <DecimalInput
                  value={file.dimensions_mm?.[index] ?? "0"}
                  onChange={(value) => setDimension(index as 0 | 1 | 2, value)}
                />
              </Field>
            </div>
          ))}
          <div className="flex items-end md:col-span-3">
            {printability ? (
              <p
                aria-live="polite"
                className={`pb-2 text-xs font-medium ${
                  printability.fits ? "text-accent" : "text-warning"
                }`}
              >
                {printability.fits
                  ? t.calculation.fitsBuildVolume(
                      String(Math.round(printability.utilizationPercent)),
                    )
                  : t.calculation.exceedsBuildVolume(
                      printability.axes
                        .map((axis) => axis.toUpperCase())
                        .join(", "),
                    )}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <SecondaryButton type="button" onClick={() => onImport("gcode")}>
          {t.calculation.importGcode}
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => onImport("stl")}>
          {t.calculation.importStl}
        </SecondaryButton>
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {t.calculation.fileMaterials}
          </h4>
          <span aria-hidden="true" className="h-px flex-1 bg-line" />
        </div>
        {file.materials.length === 0 ? (
          <p className="mb-2 text-xs text-ink-faint">{t.calculation.noFileMaterials}</p>
        ) : (
          <ul className="mb-2 divide-y divide-line overflow-hidden rounded-control border border-line">
            {file.materials.map((entry, index) => (
              <li key={`${entry.material.id}-${index}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                <span className="text-ink">
                  {entry.material.name}
                  <span className="ml-2 text-xs text-ink-faint">{formatMoney(entry.material.price, locale)} {currency}</span>
                </span>
                <IconButton
                  label={t.calculation.removeMaterialLabel(entry.material.name)}
                  onClick={() => onRemoveMaterial(index)}
                  danger
                >
                  <XIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {materials.length > 0 ? (
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Select
              value={materialPick}
              onChange={setMaterialPick}
              options={[
                { value: "", label: t.calculation.materialPick },
                ...materials.map((m) => ({ value: m.id, label: m.name })),
              ]}
              aria-label={t.calculation.materialAria}
            />
            <SecondaryButton
              type="button"
              disabled={materialPick === ""}
              onClick={() => {
                onAddMaterial(materialPick);
                setMaterialPick("");
              }}
            >
              {t.common.add}
            </SecondaryButton>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">{t.calculation.noMaterialsHint}</p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Additional items
// ---------------------------------------------------------------------------

function ItemEditor({
  items,
  files,
  currency,
  onChange,
}: {
  items: AdditionalItem[];
  files: CalculationFileInput[];
  currency: string;
  onChange: (items: AdditionalItem[]) => void;
}) {
  const t = useStrings();
  const { locale } = useLocale();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [quantity, setQuantity] = useState("1");
  const [fileId, setFileId] = useState("");

  const valid = name.trim() !== "" && isDecimalString(price) && isDecimalString(quantity);

  const add = () => {
    if (!valid) return;
    onChange([
      ...items,
      { id: newId(), name: name.trim(), price, quantity, file_id: fileId ? fileId : null },
    ]);
    setName("");
    setPrice("0");
    setQuantity("1");
    setFileId("");
  };

  return (
    <FormSection title={t.calculation.itemsTitle}>
      {items.length > 0 ? (
        <ul className="mb-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0 text-ink">
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 text-xs text-ink-faint">
                  {item.quantity} × {formatMoney(item.price, locale)} {currency}
                </span>
                <span className="ml-2 text-xs text-ink-faint">
                  {item.file_id
                    ? `${t.calculation.itemFilePrefix}: ${files.find((f) => f.id === item.file_id)?.file_name ?? "?"}`
                    : t.common.project}
                </span>
              </span>
              <IconButton
                label={t.calculation.removeItemLabel(item.name)}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                danger
              >
                <XIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <Field label={t.calculation.itemName}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.common.namePlaceholder}
              aria-label={t.calculation.itemName}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t.calculation.itemPrice}>
            <DecimalInput value={price} onChange={setPrice} aria-label={t.calculation.itemPrice} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t.calculation.itemQuantity}>
            <DecimalInput value={quantity} onChange={setQuantity} aria-label={t.calculation.itemQuantity} />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t.calculation.itemTarget}>
            <Select
              value={fileId}
              onChange={setFileId}
              options={[
                { value: "", label: t.common.project },
                ...files.map((f) => ({ value: f.id, label: f.file_name || t.calculation.unnamedFile })),
              ]}
              aria-label={t.calculation.itemTarget}
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <SecondaryButton type="button" disabled={!valid} onClick={add} className="w-full">
            {t.common.add}
          </SecondaryButton>
        </div>
      </div>
    </FormSection>
  );
}

// ---------------------------------------------------------------------------
// Percentage surcharges
// ---------------------------------------------------------------------------

function SurchargeEditor({
  surcharges,
  onChange,
}: {
  surcharges: CustomSurcharge[];
  onChange: (surcharges: CustomSurcharge[]) => void;
}) {
  const t = useStrings();
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("0");
  const [timing, setTiming] = useState<SurchargeTiming>("before-margin");

  const valid = name.trim() !== "" && isDecimalString(percent);

  const add = () => {
    if (!valid) return;
    onChange([...surcharges, { id: newId(), name: name.trim(), percent, timing }]);
    setName("");
    setPercent("0");
  };

  return (
    <FormSection title={t.calculation.surchargesTitle}>
      {surcharges.length > 0 ? (
        <ul className="mb-4 divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {surcharges.map((surcharge, index) => (
            <li key={surcharge.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="min-w-0 text-ink">
                <span className="font-medium">{surcharge.name}</span>
                <span className="ml-2 text-xs text-ink-faint">{surcharge.percent} %</span>
                <span className="ml-2 text-xs text-ink-faint">
                  {surcharge.timing === "before-margin"
                    ? t.calculation.beforeMargin
                    : t.calculation.afterMargin}
                </span>
              </span>
              <IconButton
                label={t.calculation.removeSurchargeLabel(surcharge.name)}
                onClick={() => onChange(surcharges.filter((_, i) => i !== index))}
                danger
              >
                <XIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
        <div className="md:col-span-4">
          <Field label={t.calculation.surchargeName}>
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.common.namePlaceholder}
              aria-label={t.calculation.surchargeName}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label={t.calculation.surchargePercent}>
            <DecimalInput
              value={percent}
              onChange={setPercent}
              aria-label={t.calculation.surchargePercent}
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <Field label={t.calculation.surchargeTiming}>
            <Select
              value={timing}
              onChange={(v) => setTiming(v as SurchargeTiming)}
              options={[
                { value: "before-margin", label: t.calculation.beforeMargin },
                { value: "after-margin", label: t.calculation.afterMargin },
              ]}
              aria-label={t.calculation.surchargeTiming}
            />
          </Field>
        </div>
        <div className="md:col-span-3">
          <SecondaryButton type="button" disabled={!valid} onClick={add} className="w-full">
            {t.common.add}
          </SecondaryButton>
        </div>
      </div>
    </FormSection>
  );
}
