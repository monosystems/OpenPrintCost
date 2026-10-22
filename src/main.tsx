import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MockPlatformAdapter } from "./api/mockAdapter";
import type { PlatformAdapter } from "./api/platform";
import { TauriPlatformAdapter } from "./api/tauriAdapter";
import "./styles.css";

/**
 * Adapterwahl: In der Tauri-App läuft der echte Adapter; mit
 * `VITE_MOCK_API=1` läuft die Oberfläche ohne Tauri-Binary im Browser
 * (Entwicklung, Tests, E2E).
 */
function createAdapter(): PlatformAdapter {
  if (import.meta.env.VITE_MOCK_API === "1") {
    return new MockPlatformAdapter();
  }
  return new TauriPlatformAdapter();
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root-Element fehlt.");
}

createRoot(root).render(
  <StrictMode>
    <App adapter={createAdapter()} />
  </StrictMode>,
);
