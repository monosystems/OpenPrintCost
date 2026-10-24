import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MockPlatformAdapter } from "./api/mockAdapter";
import type { PlatformAdapter } from "./api/platform";
import { TauriPlatformAdapter } from "./api/tauriAdapter";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./styles.css";

/**
 * Adapter choice: the real adapter runs in the Tauri app; with
 * `VITE_MOCK_API=1` the UI runs without a Tauri binary in the browser
 * (development, tests, E2E).
 */
function createAdapter(): PlatformAdapter {
  if (import.meta.env.VITE_MOCK_API === "1") {
    return new MockPlatformAdapter();
  }
  return new TauriPlatformAdapter();
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element missing.");
}

createRoot(root).render(
  <StrictMode>
    <App adapter={createAdapter()} />
  </StrictMode>,
);
