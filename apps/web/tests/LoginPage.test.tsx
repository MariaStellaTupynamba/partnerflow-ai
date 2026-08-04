import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/lib/api-client";
import LoginPage from "@/app/login/page";

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: { login: vi.fn() },
  };
});

afterEach(() => {
  vi.resetAllMocks();
});

function fillForm(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
}

describe("LoginPage", () => {
  it("logs in and redirects to the dashboard on success", async () => {
    vi.mocked(apiClient.login).mockResolvedValue({
      id: "1",
      email: "ada@example.com",
      isActive: true,
      createdAt: "2026-01-01T00:00:00Z",
    });

    render(<LoginPage />);
    fillForm("ada@example.com", "correct-horse-battery");

    await waitFor(() =>
      expect(apiClient.login).toHaveBeenCalledWith({
        email: "ada@example.com",
        password: "correct-horse-battery",
      }),
    );
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the server error message when login fails", async () => {
    vi.mocked(apiClient.login).mockRejectedValue(
      new ApiError("Incorrect email or password.", 401),
    );

    render(<LoginPage />);
    fillForm("ada@example.com", "wrong-password");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Incorrect email or password."),
    );
    expect(pushMock).not.toHaveBeenCalled();
  });
});
