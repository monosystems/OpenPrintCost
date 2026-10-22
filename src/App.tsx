import { useEffect, useState } from "react";
import type { PlatformAdapter } from "./api/platform";
import { HourlyRateView } from "./components/HourlyRateView";
import { MaterialView } from "./components/MaterialView";
import { PrinterView } from "./components/PrinterView";
import { WorkstepView } from "./components/WorkstepView";

type Tab = "printers" | "materials" | "worksteps" | "rates";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "printers", label: "Drucker" },
  { id: "materials", label: "Materialien" },
  { id: "worksteps", label: "Arbeitsschritte" },
  { id: "rates", label: "Stundensätze" },
];

export function App({ adapter }: { adapter: PlatformAdapter }) {
  const [tab, setTab] = useState<Tab>("printers");
  const [databasePath, setDatabasePath] = useState<string>("…");

  useEffect(() => {
    adapter
      .getDatabasePath()
      .then(setDatabasePath)
      .catch(() => setDatabasePath("unbekannt"));
  }, [adapter]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-xl font-bold">OpenPrintCost</h1>
          <p className="text-sm text-slate-400">3D-Druck-Kostenkalkulator — Stammdaten</p>
        </div>
        <nav aria-label="Stammdaten" className="mx-auto max-w-6xl px-4">
          <ul className="flex gap-1">
            {TABS.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setTab(entry.id)}
                  aria-current={tab === entry.id ? "page" : undefined}
                  className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                    tab === entry.id
                      ? "bg-slate-950 text-sky-400"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                >
                  {entry.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {tab === "printers" ? <PrinterView adapter={adapter} /> : null}
        {tab === "materials" ? <MaterialView adapter={adapter} /> : null}
        {tab === "worksteps" ? <WorkstepView adapter={adapter} /> : null}
        {tab === "rates" ? <HourlyRateView adapter={adapter} /> : null}
      </main>

      <footer className="border-t border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <p className="text-xs text-slate-500" title={databasePath}>
            Datenbank: {databasePath}
          </p>
        </div>
      </footer>
    </div>
  );
}
