import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { MockPlatformAdapter } from "./api/mockAdapter";

describe("App footer", () => {
  it("shows the build number instead of the database path", async () => {
    const adapter = new MockPlatformAdapter();
    adapter.appVersion = "9.8.7";
    render(<App adapter={adapter} />);

    expect(await screen.findByText("Build: 9.8.7")).toBeInTheDocument();
    expect(screen.queryByText(/^Database:/)).not.toBeInTheDocument();
  });
});
