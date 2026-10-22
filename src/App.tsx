import { useEffect, useState } from "react";
import type { PlatformAdapter } from "./api/platform";
import { de } from "./i18n/de";
import { ProfilesView } from "./components/ProfilesView";
import { SettingsView } from "./components/SettingsView";
import { CalculationView } from "./components/CalculationView";
import { HourlyRateView } from "./components/HourlyRateView";
import { MaterialView } from "./components/MaterialView";
import { PrinterView } from "./components/PrinterView";
import { WorkstepView } from "./components/WorkstepView";

type Tab = "calculation" | "printers" | "materials" | "worksteps" | "rates" | "profiles" | "settings";

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: "calculation", label: de.app.tabs.calculation },
  { id: "printers", label: de.app.tabs.printers },
  { id: "materials", label: de.app.tabs.materials },
  { id: "worksteps", label: de.app.tabs.worksteps },
  { id: "rates", label: de.app.tabs.rates },
  { id: "profiles", label: de.app.tabs.profiles },
  { id: "settings", label: de.app.tabs.settings },
];

export function App({ adapter }: { adapter: PlatformAdapter }) {
  const [tab, setTab] = useState<Tab>("calculation");
  const [databasePath, setDatabasePath] = useState<string>("…");

  useEffect(() => {
    adapter
      .getDatabasePath()
      .then(setDatabasePath)
      .catch(() => setDatabasePath(de.app.unknown));
  }, [adapter]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <h1 className="text-xl font-bold">{de.app.title}</h1>
          <p className="text-sm text-slate-400">{de.app.subtitle}</p>
        </div>
        <nav aria-label={de.app.navLabel} className="mx-auto max-w-6xl px-4">
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
        {tab === "calculation" ? <CalculationView adapter={adapter} /> : null}
        {tab === "printers" ? <PrinterView adapter={adapter} /> : null}
        {tab === "materials" ? <MaterialView adapter={adapter} /> : null}
        {tab === "worksteps" ? <WorkstepView adapter={adapter} /> : null}
        {tab === "rates" ? <HourlyRateView adapter={adapter} /> : null}
        {tab === "profiles" ? <ProfilesView adapter={adapter} /> : null}
        {tab === "settings" ? <SettingsView adapter={adapter} /> : null}
      </main>

      <footer className="border-t border-slate-800 bg-slate-900">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <p className="text-xs text-slate-500" title={databasePath}>
            {de.app.database}: {databasePath}
          </p>
        </div>
      </footer>
    </div>
  );
}
