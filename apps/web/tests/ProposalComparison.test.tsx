import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/lib/api-client";
import { ProposalComparison } from "@/components/ProposalComparison";

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: { compareProposals: vi.fn() },
  };
});

afterEach(() => {
  vi.resetAllMocks();
});

const proposals = [
  {
    id: "p1",
    vendorId: "v1",
    title: "Standard package",
    price: "1200.00",
    currency: "USD",
    summary: "Details A",
    submittedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "p2",
    vendorId: "v2",
    title: "Premium package",
    price: "950.00",
    currency: "USD",
    summary: "Details B",
    submittedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const vendorNamesById = { v1: "Acme", v2: "Globex" };

describe("ProposalComparison", () => {
  it("shows an empty state when there are no proposals", () => {
    render(<ProposalComparison proposals={[]} vendorNamesById={{}} />);

    expect(screen.getByText(/No proposals yet/)).toBeInTheDocument();
  });

  it("disables the compare button until at least two proposals are selected", () => {
    render(<ProposalComparison proposals={proposals} vendorNamesById={vendorNamesById} />);

    const button = screen.getByRole("button", { name: /^Compare \d/ });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Acme/));
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Globex/));
    expect(button).toBeEnabled();
  });

  it("shows the AI summary after a successful comparison", async () => {
    vi.mocked(apiClient.compareProposals).mockResolvedValue({
      summary: "Globex is cheaper but has a slightly better SLA.",
    });

    render(<ProposalComparison proposals={proposals} vendorNamesById={vendorNamesById} />);
    fireEvent.click(screen.getByLabelText(/Acme/));
    fireEvent.click(screen.getByLabelText(/Globex/));
    fireEvent.click(screen.getByRole("button", { name: /^Compare \d/ }));

    await waitFor(() =>
      expect(apiClient.compareProposals).toHaveBeenCalledWith({ proposalIds: ["p1", "p2"] }),
    );
    expect(
      await screen.findByText("Globex is cheaper but has a slightly better SLA."),
    ).toBeInTheDocument();
  });

  it("shows a clear message when the AI provider isn't configured", async () => {
    vi.mocked(apiClient.compareProposals).mockRejectedValue(
      new ApiError("AI comparison is not configured on this server.", 503),
    );

    render(<ProposalComparison proposals={proposals} vendorNamesById={vendorNamesById} />);
    fireEvent.click(screen.getByLabelText(/Acme/));
    fireEvent.click(screen.getByLabelText(/Globex/));
    fireEvent.click(screen.getByRole("button", { name: /^Compare \d/ }));

    expect(
      await screen.findByText("AI comparison is not configured on this server."),
    ).toBeInTheDocument();
  });
});
