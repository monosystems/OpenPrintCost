import { useEffect, useRef, useState, type ReactNode } from "react";
import logoMark from "./assets/logo-mark.png";
import type { PlatformAdapter } from "./api/platform";
import { LanguageProvider, useLocale } from "./i18n";
import { useUpdateCheck } from "./hooks/useUpdateCheck";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { UpdateBadge } from "./components/UpdateBadge";
import { ProfilesView } from "./components/ProfilesView";
import { SettingsView } from "./components/SettingsView";
import { CalculationView } from "./components/CalculationView";
import { HourlyRateView } from "./components/HourlyRateView";
import { MaterialView } from "./components/MaterialView";
import { PrinterView } from "./components/PrinterView";
import { WorkstepView } from "./components/WorkstepView";
import {
  CalculatorIcon,
  ClockIcon,
  LayersIcon,
  PrinterIcon,
  SettingsIcon,
  SlidersIcon,
  WrenchIcon,
} from "./components/icons";

type Tab = "calculation" | "printers" | "materials" | "worksteps" | "rates" | "profiles" | "settings";

interface NavItem {
  id: Tab;
  label: string;
  icon: ReactNode;
}

export function App({ adapter }: { adapter: PlatformAdapter }) {
  return (
    <LanguageProvider>
      <Shell adapter={adapter} />
    </LanguageProvider>
  );
}

function Shell({ adapter }: { adapter: PlatformAdapter }) {
  const { t } = useLocale();
  const [tab, setTab] = useState<Tab>("calculation");
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<Tab>>(
    () => new Set<Tab>(["calculation"]),
  );
  const [build, setBuild] = useState<string>("…");
  const { update, noteUpdate } = useUpdateCheck(adapter);
  const mainRef = useRef<HTMLElement>(null);

  /** Mount a tab on first visit; keep it mounted so its state survives. */
  const showTab = (next: Tab) => {
    setMountedTabs((current) =>
      current.has(next) ? current : new Set([...current, next]),
    );
    setTab(next);
  };

  useEffect(() => {
    adapter
      .getAppVersion()
      .then(setBuild)
      .catch(() => setBuild(t.app.unknown));
  }, [adapter, t]);

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
  }, [tab]);

  const calculation: NavItem = {
    id: "calculation",
    label: t.app.tabs.calculation,
    icon: <CalculatorIcon />,
  };
  const masterData: NavItem[] = [
    { id: "printers", label: t.app.tabs.printers, icon: <PrinterIcon /> },
    { id: "materials", label: t.app.tabs.materials, icon: <LayersIcon /> },
    { id: "worksteps", label: t.app.tabs.worksteps, icon: <WrenchIcon /> },
    { id: "rates", label: t.app.tabs.rates, icon: <ClockIcon /> },
    { id: "profiles", label: t.app.tabs.profiles, icon: <SlidersIcon /> },
  ];
  const system: NavItem[] = [
    { id: "settings", label: t.app.tabs.settings, icon: <SettingsIcon /> },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-surface">
        <div className="flex items-center gap-3 px-4 py-4">
          <img src={logoMark} alt="" aria-hidden="true" className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight">{t.app.title}</h1>
            <p className="truncate text-[11px] text-ink-muted">{t.app.subtitle}</p>
          </div>
        </div>

        <nav aria-label={t.app.navLabel} className="flex-1 overflow-y-auto px-2 pb-3">
          <SidebarItem
            item={calculation}
            active={tab === "calculation"}
            onSelect={showTab}
          />
          <SidebarSection label={t.app.masterData} />
          {masterData.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={tab === item.id}
              onSelect={showTab}
            />
          ))}
          <SidebarSection label={t.app.system} />
          {system.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={tab === item.id}
              onSelect={showTab}
            />
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <UpdateBadge update={update} onOpen={() => showTab("settings")} />
            <LanguageSwitcher placement="up" />
          </div>
          <p className="font-mono text-[11px] text-ink-faint" title={build}>
            {t.app.build}: {build}
          </p>
        </div>
      </aside>

      <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl px-6 py-6">
          {/* Visited views stay mounted so an in-progress calculation survives tab changes. */}
          {mountedTabs.has("calculation") ? (
            <div hidden={tab !== "calculation"}>
              <CalculationView
                adapter={adapter}
                active={tab === "calculation"}
                onNavigate={showTab}
              />
            </div>
          ) : null}
          {mountedTabs.has("printers") ? (
            <div hidden={tab !== "printers"}>
              <PrinterView adapter={adapter} />
            </div>
          ) : null}
          {mountedTabs.has("materials") ? (
            <div hidden={tab !== "materials"}>
              <MaterialView adapter={adapter} />
            </div>
          ) : null}
          {mountedTabs.has("worksteps") ? (
            <div hidden={tab !== "worksteps"}>
              <WorkstepView adapter={adapter} />
            </div>
          ) : null}
          {mountedTabs.has("rates") ? (
            <div hidden={tab !== "rates"}>
              <HourlyRateView adapter={adapter} />
            </div>
          ) : null}
          {mountedTabs.has("profiles") ? (
            <div hidden={tab !== "profiles"}>
              <ProfilesView adapter={adapter} />
            </div>
          ) : null}
          {mountedTabs.has("settings") ? (
            <div hidden={tab !== "settings"}>
              <SettingsView adapter={adapter} onUpdateChange={noteUpdate} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function SidebarSection({ label }: { label: string }) {
  return (
    <p className="mt-5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
      {label}
    </p>
  );
}

function SidebarItem({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-soft text-brand-ink"
          : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      <span className={active ? "text-brand-ink" : "text-ink-faint"}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </button>
  );
}
