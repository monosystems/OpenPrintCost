/**
 * Statisches Platzhalter-Gerüst.
 *
 * Bewusst ohne Fachlogik und ohne `@tauri-apps/api`-Imports:
 * Die Anbindung an den Rust-Backend folgt in einem späteren Block.
 */

const PLANNED_BLOCKS = [
  'Stammdatenverwaltung (Materialien, Maschinen, Stromtarife)',
  'Druckaufträge und Kostenberechnung',
  'Export als PDF / CSV',
] as const;

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 px-6 py-5">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          OpenPrintCost
        </h1>
        <p className="mt-1 text-sm text-slate-400">3D-Druck-Kostenkalkulator</p>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <section
          className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl"
          aria-labelledby="placeholder-heading"
        >
          <h2
            id="placeholder-heading"
            className="text-lg font-medium text-slate-200"
          >
            Grundgerüst bereit — Stammdatenverwaltung folgt in Block 4
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Die Desktop-Oberfläche ist eingerichtet. Die folgenden Bausteine sind
            geplant:
          </p>

          <ul className="mt-5 space-y-2">
            {PLANNED_BLOCKS.map((block) => (
              <li
                key={block}
                className="flex items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"
              >
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600"
                  aria-hidden="true"
                />
                <span>{block}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-800 px-6 py-4 text-xs text-slate-500">
        Tauri v2 · React · TypeScript · Vite · Tailwind CSS
      </footer>
    </div>
  );
}
