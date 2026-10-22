import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// Ohne `globals: true` registriert Testing Library sein Auto-Cleanup nicht
// selbst — deshalb hier explizit: Jeder Test startet mit leerem DOM.
afterEach(() => {
  cleanup();
});
