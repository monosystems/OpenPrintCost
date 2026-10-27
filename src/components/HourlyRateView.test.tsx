import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MockPlatformAdapter } from "../api/mockAdapter";
import { en } from "../i18n/en";
import { HourlyRateView } from "./HourlyRateView";

async function renderView(adapter = new MockPlatformAdapter()) {
  const user = userEvent.setup();
  render(<HourlyRateView adapter={adapter} />);
  await waitFor(() => expect(screen.queryByText(en.common.loading)).not.toBeInTheDocument());
  return { user, adapter };
}

describe("HourlyRateView", () => {
  it("shows the empty state without hourly rates", async () => {
    await renderView();
    expect(screen.getByText(en.rates.empty)).toBeInTheDocument();
  });

  it("groups the hourly rate form into labelled sections", async () => {
    const { user } = await renderView();

    await user.click(screen.getByRole("button", { name: en.rates.newButton }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(en.rates.sectionGeneral)).toBeInTheDocument();
    expect(within(dialog).getByText(en.rates.sectionMachine)).toBeInTheDocument();
    expect(
      within(dialog).getByText(`${en.rates.fixedGroup} ${en.rates.perYear} ($)`),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(`${en.rates.variableGroup} ($/h)`)).toBeInTheDocument();
    expect(within(dialog).getByText(en.common.requiredHint)).toBeInTheDocument();
  });

  it("creates an hourly rate via the form", async () => {
    const { user, adapter } = await renderView();

    await user.click(screen.getByRole("button", { name: en.rates.newButton }));
    await user.type(screen.getByPlaceholderText(en.rates.nameExample), "Office printer 2026");
    await user.click(screen.getByRole("button", { name: en.common.save }));

    await waitFor(() => expect(screen.getByText("Office printer 2026")).toBeInTheDocument());
    expect(await adapter.listHourlyRates()).toHaveLength(1);
  });
});
