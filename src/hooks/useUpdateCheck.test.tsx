import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { useUpdateCheck } from "./useUpdateCheck";

describe("useUpdateCheck", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks at startup, repeats on the interval, and stops on unmount", async () => {
    vi.useFakeTimers();
    const adapter = new MockPlatformAdapter();
    const check = vi.spyOn(adapter, "checkForUpdate");

    const { unmount } = renderHook(() => useUpdateCheck(adapter, 60_000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(check).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(check).toHaveBeenCalledTimes(2);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("returns the offered update", async () => {
    const adapter = new MockPlatformAdapter();
    adapter.availableUpdate = {
      version: "0.2.0",
      currentVersion: "0.1.3",
      notes: null,
      date: null,
    };

    const { result } = renderHook(() => useUpdateCheck(adapter));

    await waitFor(() => expect(result.current.update).toEqual(adapter.availableUpdate));
  });

  it("publishes manual check results via noteUpdate", async () => {
    const adapter = new MockPlatformAdapter();
    const offered = {
      version: "0.2.0",
      currentVersion: "0.1.3",
      notes: null,
      date: null,
    };
    const { result } = renderHook(() => useUpdateCheck(adapter));

    act(() => result.current.noteUpdate(offered));
    expect(result.current.update).toEqual(offered);

    act(() => result.current.noteUpdate(null));
    expect(result.current.update).toBeNull();
  });

  it("stays quiet when the check fails", async () => {
    const adapter = new MockPlatformAdapter();
    const check = vi
      .spyOn(adapter, "checkForUpdate")
      .mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useUpdateCheck(adapter));

    await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    expect(result.current.update).toBeNull();
  });
});
