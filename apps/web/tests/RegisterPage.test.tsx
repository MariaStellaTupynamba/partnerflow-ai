import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/lib/api-client";
import RegisterPage from "@/app/register/page";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: { register: vi.fn() },
  };
});

afterEach(() => {
  vi.resetAllMocks();
});

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /create account/i }));
}

describe("RegisterPage", () => {
  it("registers and redirects to the dashboard on success", async () => {
    vi.mocked(apiClient.register).mockResolvedValue({
      id: "1",
      email: "ada@example.com",
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
    });

    render(<RegisterPage />);
    fillForm("ada@example.com", "correct-horse-battery");

    await waitFor(() =>
      expect(apiClient.register).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "correct-horse-battery",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the server error message when registration fails", async () => {
    vi.mocked(apiClient.register).mockRejectedValue(
      new ApiError("An account with this email already exists.", 409),
    );

    render(<RegisterPage />);
    fillForm("ada@example.com", "correct-horse-battery");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "An account with this email already exists.",
      ),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
