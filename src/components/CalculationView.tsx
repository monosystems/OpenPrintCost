import { useCallback, useEffect, useState } from "react";
import type { PlatformAdapter } from "../api/platform";
import { formatMoney, isDecimalString } from "../api/format";
import {
  newId,
  type AdditionalItem,
  type CalculationFileInput,
  type CalculationInput,
  type CalculationProfile,
  type CalculationResult,
  type CalculationSummary,
  type CustomSurcharge,
  type HourlyRate,
  type Material,
  type Printer,
  type SurchargeTiming,
  type Workstep,
} from "../api/types";
import { CalculationResultView } from "./CalculationResultView";
import {
  ConfirmDialog,
  DecimalInput,
  EmptyState,
  ErrorBanner,
  Field,
  PrimaryButton,
  SecondaryButton,
  Select,
  TextInput,
} from "./ui";

function defaultProfile(): CalculationProfile {
  return {
    id: newId(),
    name: "Standard",
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
    weight_g: null,
    materials: [],
    material_changes: 0,
    multiply_print_time_with_quantity: null,
  };
}

function emptyCalculation(printer: Printer): CalculationInput {
  return {
    id: newId(),
    project_name: "",
    notes: null,
    created_at: null,
    printer: { ...printer },
    profile: defaultProfile(),
    hourly_rate: null,
    worksteps: [],
    additional_items: [],
    custom_surcharges: [],
    files: [],
  };
}

const emptyDecimal = (value: string | null) => value ?? "";

export function CalculationView({ adapter }: { adapter: PlatformAdapter }) {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allWorksteps, setAllWorksteps] = useState<Workstep[]>([]);
  const [rates, setRates] = useState<HourlyRate[]>([]);
  const [saved, setSaved] = useState<CalculationSummary[]>([]);
  const [current, setCurrent] = useState<CalculationInput | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingSaved, setDeletingSaved] = useState<CalculationSummary | null>(null);
  const [importHint, setImportHint] = useState<string | null>(null);

  const reloadBase = useCallback(async () => {
    try {
      const [p, m, w, r, s] = await Promise.all([
        adapter.listPrinters(),
        adapter.listMaterials(),
        adapter.listWorksteps(),
        adapter.listHourlyRates(),
        adapter.listCalculations(),
      ]);
      setPrinters(p);
      setMaterials(m);
      setAllWorksteps(w);
      setRates(r);
      setSaved(s);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Stammdaten konnten nicht geladen werden.");
    }
  }, [adapter]);

  useEffect(() => {
    void reloadBase();
  }, [reloadBase]);

  const fail = (message: string) => setError(message);
  const update = (patch: Partial<CalculationInput>) =>
    setCurrent((current) => (current ? { ...current, ...patch } : current));

  const newCalculation = () => {
    if (printers.length === 0) {
      fail("Bitte zuerst einen Drucker anlegen (Tab „Drucker“).");
      return;
    }
    const first = printers[0];
    if (!first) return;
    setCurrent(emptyCalculation(first));
    setResult(null);
  };

  const loadSaved = async (id: string) => {
    try {
      const stored = await adapter.getCalculation(id);
      setCurrent(structuredClone(stored.document));
      setResult(null);
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Kalkulation konnte nicht geladen werden.");
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
      fail(error instanceof Error ? error.message : "Kalkulation konnte nicht gelöscht werden.");
    }
  };

  const calculate = async () => {
    if (!current) return;
    if (current.project_name.trim() === "") {
      fail("Bitte einen Projektnamen eingeben.");
      return;
    }
    if (current.files.length === 0) {
      fail("Bitte mindestens eine Datei hinzufügen.");
      return;
    }
    try {
      setResult(await adapter.calculate(current));
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Berechnung ist fehlgeschlagen.");
    }
  };

  const save = async () => {
    if (!current) return;
    if (current.project_name.trim() === "") {
      fail("Bitte einen Projektnamen eingeben.");
      return;
    }
    try {
      await adapter.saveCalculation(current);
      setSaved(await adapter.listCalculations());
      setError(null);
    } catch (error) {
      fail(error instanceof Error ? error.message : "Kalkulation konnte nicht gespeichert werden.");
    }
  };

  const updateFile = (fileId: string, patch: Partial<CalculationFileInput>) =>
    setCurrent((current) =>
      current
        ? { ...current, files: current.files.map((f) => (f.id === fileId ? { ...f, ...patch } : f)) }
        : current,
    );

  const removeFile = (fileId: string) =>
    setCurrent((current) =>
      current ? { ...current, files: current.files.filter((f) => f.id !== fileId) } : current,
    );

  const addMaterialToFile = (fileId: string, materialId: string) => {
    const material = materials.find((m) => m.id === materialId);
    if (!material) return;
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
        setImportHint(
          info.detected_slicer
            ? `${info.detected_slicer} erkannt — Druckzeit ${info.used_comments ? "aus Kommentaren" : "simuliert"} übernommen.`
            : "Druckzeit aus der Datei übernommen.",
        );
      } else if (kind === "stl" && "volume_cm3" in info) {
        updateFile(fileId, { volume_cm3: info.volume_cm3 });
        setImportHint(`${info.triangle_count} Dreiecke — Volumen übernommen.`);
      }
    } catch (error) {
      fail(error instanceof Error ? error.message : "Import ist fehlgeschlagen.");
    }
  };

  const toggleWorkstep = (workstep: Workstep) =>
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

  const updateProfile = (patch: Partial<CalculationProfile>) =>
    setCurrent((current) =>
      current ? { ...current, profile: { ...current.profile, ...patch } } : current,
    );

  return (
    <section aria-label="Kalkulation">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-100">Kalkulation</h2>
        <PrimaryButton type="button" onClick={newCalculation}>
          Neue Kalkulation
        </PrimaryButton>
      </div>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}
      {importHint ? (
        <div role="status" className="mb-4 rounded-md border border-sky-900 bg-sky-950/60 px-4 py-3">
          <p className="text-sm text-sky-200">{importHint}</p>
        </div>
      ) : null}

      {saved.length > 0 ? (
        <div className="mb-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
            Gespeichert
          </h3>
          <ul className="space-y-1">
            {saved.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => void loadSaved(entry.id)}
                  className="truncate text-left text-sky-400 hover:text-sky-300 hover:underline"
                >
                  {entry.project_name}
                  <span className="ml-2 text-xs text-slate-500">
                    {entry.file_count} Datei(en) · {entry.total_quantity} Stk.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingSaved(entry)}
                  aria-label={`Kalkulation ${entry.project_name} löschen`}
                  className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!current ? (
        <EmptyState message="Noch keine Kalkulation geöffnet. Lege eine neue an oder lade eine gespeicherte." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Projektname *">
              <TextInput
                value={current.project_name}
                onChange={(e) => update({ project_name: e.target.value })}
                placeholder="z. B. Gehäuse-Serie"
              />
            </Field>
            <Field label="Notizen">
              <TextInput
                value={current.notes ?? ""}
                onChange={(e) => update({ notes: e.target.value ? e.target.value : null })}
              />
            </Field>
            <Field label="Drucker">
              <Select
                value={current.printer.id}
                onChange={(id) => {
                  const found = printers.find((p) => p.id === id);
                  if (found) update({ printer: { ...found } });
                }}
                options={printers.map((p) => ({ value: p.id, label: p.model }))}
              />
            </Field>
            <Field label="Stundensatz (optional)">
              <Select
                value={current.hourly_rate?.id ?? ""}
                onChange={(id) => {
                  const found = rates.find((r) => r.id === id);
                  update({ hourly_rate: found ? { ...found } : null });
                }}
                options={[
                  { value: "", label: "— Stundensatz vom Drucker —" },
                  ...rates.map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </Field>
          </div>

          <ProfileForm
            profile={current.profile}
            onChange={updateProfile}
          />

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium uppercase tracking-wide text-slate-400">Dateien</h3>
              <SecondaryButton type="button" onClick={() => update({ files: [...current.files, emptyFile()] })}>
                Datei hinzufügen
              </SecondaryButton>
            </div>
            {current.files.length === 0 ? (
              <EmptyState message="Noch keine Dateien. Füge eine Datei manuell hinzu oder importiere GCode/STL." />
            ) : (
              <ul className="space-y-3">
                {current.files.map((file) => (
                  <FileCard
                    key={file.id}
                    file={file}
                    materials={materials}
                    onChange={(patch) => updateFile(file.id, patch)}
                    onRemove={() => removeFile(file.id)}
                    onAddMaterial={(materialId) => addMaterialToFile(file.id, materialId)}
                    onRemoveMaterial={(index) =>
                      updateFile(file.id, { materials: file.materials.filter((_, i) => i !== index) })
                    }
                    onImport={(kind) => void importIntoFile(file.id, kind)}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
              Arbeitsschritte
            </h3>
            {allWorksteps.length === 0 ? (
              <p className="text-sm text-slate-500">Keine Arbeitsschritte angelegt (Tab „Arbeitsschritte“).</p>
            ) : (
              <ul className="space-y-1">
                {allWorksteps.map((workstep) => {
                  const selected = current.worksteps.some((w) => w.id === workstep.id);
                  return (
                    <li key={workstep.id}>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleWorkstep(workstep)}
                          className="h-4 w-4 accent-sky-600"
                        />
                        {workstep.name}
                        <span className="text-xs text-slate-500">
                          ({formatMoney(workstep.price)} €)
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <ItemEditor
            items={current.additional_items}
            files={current.files}
            onChange={(items) => update({ additional_items: items })}
          />
          <SurchargeEditor
            surcharges={current.custom_surcharges}
            onChange={(surcharges) => update({ custom_surcharges: surcharges })}
          />

          <div className="mt-6 flex gap-3">
            <PrimaryButton type="button" onClick={() => void calculate()}>
              Berechnen
            </PrimaryButton>
            <SecondaryButton type="button" onClick={() => void save()}>
              Speichern
            </SecondaryButton>
          </div>

          {result ? <CalculationResultView result={result} files={current.files} /> : null}
        </>
      )}

      {deletingSaved ? (
        <ConfirmDialog
          title="Kalkulation löschen"
          message={`„${deletingSaved.project_name}“ wirklich löschen? Dieser Vorgang kann nicht rückgängig gemacht werden.`}
          confirmLabel="Löschen"
          onConfirm={() => void confirmDeleteSaved()}
          onCancel={() => setDeletingSaved(null)}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Profil (inline — die Verwaltung benannter Profile gehört zu Block 7)
// ---------------------------------------------------------------------------

function ProfileForm({
  profile,
  onChange,
}: {
  profile: CalculationProfile;
  onChange: (patch: Partial<CalculationProfile>) => void;
}) {
  const set = (key: keyof CalculationProfile, value: string | boolean) =>
    onChange({ [key]: value } as Partial<CalculationProfile>);
  const num = (
    label: string,
    key: "fail_rate_percent" | "tax_rate_percent" | "margin_percent" | "handling_fee" | "energy_price_per_kwh" | "power_level_percent" | "print_time_factor",
  ) => (
    <Field label={label}>
      <DecimalInput value={profile[key]} onChange={(v) => set(key, v)} />
    </Field>
  );
  const check = (label: string, key: "apply_energy_costs" | "combine_materials" | "multiply_print_time_with_quantity" | "exclude_machine_from_margin" | "exclude_material_from_margin" | "exclude_worksteps_from_margin") => (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={profile[key]}
        onChange={(e) => set(key, e.target.checked)}
        className="h-4 w-4 accent-sky-600"
      />
      {label}
    </label>
  );

  return (
    <fieldset className="mt-6 rounded-lg border border-slate-800 p-4">
      <legend className="px-2 text-sm font-medium uppercase tracking-wide text-slate-400">
        Kalkulationsprofil
      </legend>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {num("Fehlerrate (%)", "fail_rate_percent")}
        {num("Steuersatz (%)", "tax_rate_percent")}
        {num("Marge (%)", "margin_percent")}
        {num("Pauschale (€)", "handling_fee")}
        {num("Energie (€/kWh)", "energy_price_per_kwh")}
        {num("Leistungsgrad (%)", "power_level_percent")}
        {num("Zeitfaktor", "print_time_factor")}
        <Field label="Pauschale wirkt">
          <Select
            value={profile.handling_fee_scope}
            onChange={(v) => onChange({ handling_fee_scope: v as "per-file" | "once" })}
            options={[
              { value: "once", label: "einmal je Kalkulation" },
              { value: "per-file", label: "je Datei" },
            ]}
          />
        </Field>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
        {check("Energiekosten anwenden", "apply_energy_costs")}
        {check("Materialien zusammenfassen", "combine_materials")}
        {check("Druckzeit × Stückzahl", "multiply_print_time_with_quantity")}
        {check("Maschine ohne Marge", "exclude_machine_from_margin")}
        {check("Material ohne Marge", "exclude_material_from_margin")}
        {check("Arbeitsschritte ohne Marge", "exclude_worksteps_from_margin")}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Datei-Karte
// ---------------------------------------------------------------------------

function FileCard({
  file,
  materials,
  onChange,
  onRemove,
  onAddMaterial,
  onRemoveMaterial,
  onImport,
}: {
  file: CalculationFileInput;
  materials: Material[];
  onChange: (patch: Partial<CalculationFileInput>) => void;
  onRemove: () => void;
  onAddMaterial: (materialId: string) => void;
  onRemoveMaterial: (index: number) => void;
  onImport: (kind: "gcode" | "stl") => void;
}) {
  const [materialPick, setMaterialPick] = useState("");
  const num = (value: string | null) => emptyDecimal(value);

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <TextInput
          value={file.file_name}
          onChange={(e) => onChange({ file_name: e.target.value })}
          placeholder="Dateiname, z. B. Gehäuse.stl"
          aria-label="Dateiname"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Datei ${file.file_name || "ohne Namen"} entfernen`}
          className="shrink-0 rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Field label="Stückzahl">
          <TextInput
            value={String(file.quantity)}
            inputMode="numeric"
            onChange={(e) => {
              const parsed = Number.parseInt(e.target.value, 10);
              onChange({ quantity: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 });
            }}
          />
        </Field>
        <Field label="Druckzeit (h)">
          <DecimalInput value={file.print_time_hours} onChange={(v) => onChange({ print_time_hours: v })} />
        </Field>
        <Field label="Volumen (cm³)">
          <DecimalInput value={num(file.volume_cm3)} onChange={(v) => onChange({ volume_cm3: v ? v : null })} />
        </Field>
        <Field label="Gewicht (g)">
          <DecimalInput value={num(file.weight_g)} onChange={(v) => onChange({ weight_g: v ? v : null })} />
        </Field>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryButton type="button" onClick={() => onImport("gcode")}>
          GCode importieren
        </SecondaryButton>
        <SecondaryButton type="button" onClick={() => onImport("stl")}>
          STL importieren
        </SecondaryButton>
      </div>
      <div className="mt-3">
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Materialien</h4>
        {file.materials.length === 0 ? (
          <p className="mb-2 text-xs text-slate-500">Noch kein Material zugeordnet.</p>
        ) : (
          <ul className="mb-2 space-y-1">
            {file.materials.map((entry, index) => (
              <li key={`${entry.material.id}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-200">
                  {entry.material.name}
                  <span className="ml-2 text-xs text-slate-500">{formatMoney(entry.material.price)} €</span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveMaterial(index)}
                  aria-label={`Material ${entry.material.name} entfernen`}
                  className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {materials.length > 0 ? (
          <div className="flex gap-2">
            <Select
              value={materialPick}
              onChange={setMaterialPick}
              options={[
                { value: "", label: "Material wählen …" },
                ...materials.map((m) => ({ value: m.id, label: m.name })),
              ]}
              aria-label="Material wählen"
            />
            <SecondaryButton
              type="button"
              disabled={materialPick === ""}
              onClick={() => {
                onAddMaterial(materialPick);
                setMaterialPick("");
              }}
            >
              Hinzufügen
            </SecondaryButton>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Keine Materialien angelegt (Tab „Materialien“).</p>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Zusatzartikel
// ---------------------------------------------------------------------------

function ItemEditor({
  items,
  files,
  onChange,
}: {
  items: AdditionalItem[];
  files: CalculationFileInput[];
  onChange: (items: AdditionalItem[]) => void;
}) {
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
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
        Zusatzartikel
      </h3>
      {items.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-200">
                {item.name} · {item.quantity} × {formatMoney(item.price)} €
                <span className="ml-2 text-xs text-slate-500">
                  {item.file_id
                    ? `Datei: ${files.find((f) => f.id === item.file_id)?.file_name ?? "?"}`
                    : "Projekt"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                aria-label={`Artikel ${item.name} entfernen`}
                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Artikelname" />
        <DecimalInput value={price} onChange={setPrice} aria-label="Artikelpreis" />
        <DecimalInput value={quantity} onChange={setQuantity} aria-label="Artikelmenge" />
        <Select
          value={fileId}
          onChange={setFileId}
          options={[
            { value: "", label: "Projekt" },
            ...files.map((f) => ({ value: f.id, label: f.file_name || "Datei ohne Namen" })),
          ]}
          aria-label="Zuordnung"
        />
        <SecondaryButton type="button" disabled={!valid} onClick={add}>
          Hinzufügen
        </SecondaryButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prozentuale Zuschläge
// ---------------------------------------------------------------------------

function SurchargeEditor({
  surcharges,
  onChange,
}: {
  surcharges: CustomSurcharge[];
  onChange: (surcharges: CustomSurcharge[]) => void;
}) {
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
    <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
        Prozentuale Zuschläge
      </h3>
      {surcharges.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {surcharges.map((surcharge, index) => (
            <li key={surcharge.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-200">
                {surcharge.name} · {surcharge.percent} %
                <span className="ml-2 text-xs text-slate-500">
                  {surcharge.timing === "before-margin" ? "vor der Marge" : "nach der Marge"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(surcharges.filter((_, i) => i !== index))}
                aria-label={`Zuschlag ${surcharge.name} entfernen`}
                className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-red-300"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Zuschlagsname" />
        <DecimalInput value={percent} onChange={setPercent} aria-label="Prozentsatz" />
        <Select
          value={timing}
          onChange={(v) => setTiming(v as SurchargeTiming)}
          options={[
            { value: "before-margin", label: "vor der Marge" },
            { value: "after-margin", label: "nach der Marge" },
          ]}
          aria-label="Zeitpunkt"
        />
        <SecondaryButton type="button" disabled={!valid} onClick={add}>
          Hinzufügen
        </SecondaryButton>
      </div>
    </div>
  );
}
