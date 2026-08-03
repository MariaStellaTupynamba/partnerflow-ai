import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiHealthStatus } from "@/components/ApiHealthStatus";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    getHealth: vi.fn(),
  },
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("ApiHealthStatus", () => {
  it("shows a checking state before the health check resolves", () => {
    vi.mocked(apiClient.getHealth).mockReturnValue(new Promise(() => {}));

    render(<ApiHealthStatus />);

    expect(screen.getByRole("status")).toHaveTextContent("Checking API…");
  });

  it("shows online once the API reports status ok", async () => {
    vi.mocked(apiClient.getHealth).mockResolvedValue({
      status: "ok",
      service: "partnerflow-api",
      version: "0.1.0",
      database: "connected",
    });

    render(<ApiHealthStatus />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("API online"));
  });

  it("shows offline when the health check request fails", async () => {
    vi.mocked(apiClient.getHealth).mockRejectedValue(new Error("network error"));

    render(<ApiHealthStatus />);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("API offline"));
  });
});
