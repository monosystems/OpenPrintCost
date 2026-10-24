import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UpdateBadge } from "./UpdateBadge";

const offered = {
  version: "0.2.0",
  currentVersion: "0.1.3",
  notes: "Faster calculations.",
  date: "2026-10-24T07:00:00Z",
};

describe("UpdateBadge", () => {
  it("renders nothing while no update is offered", () => {
    render(<UpdateBadge update={null} onOpen={() => {}} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("names the offered version and calls onOpen when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<UpdateBadge update={offered} onOpen={onOpen} />);

    const badge = screen.getByRole("button", {
      name: "Update available: version 0.2.0",
    });
    expect(badge).toHaveAttribute("title", "Update available: version 0.2.0");

    await user.click(badge);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
