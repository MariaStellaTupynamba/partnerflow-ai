import type {
  ComparisonRequest,
  ComparisonResponse,
  HealthCheckResponse,
  LoginRequest,
  Proposal,
  ProposalCreate,
  ProposalUpdate,
  RegisterRequest,
  UserPublic,
  Vendor,
  VendorCreate,
  VendorUpdate,
} from "@partnerflow/shared-types";

import { env } from "@/lib/env";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const CSRF_TOKEN_COOKIE = "csrf_token";
const CSRF_TOKEN_HEADER = "x-csrf-token";

/**
 * Reads the (deliberately non-httpOnly) CSRF cookie set alongside the auth cookies on
 * login/register, and mirrors it back as a header — the "double-submit cookie" pattern. A
 * cross-site attacker can make the browser attach cookies to a forged request, but can't read
 * this cookie's value to forge a matching header. See app/core/csrf.py on the backend.
 */
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const csrfToken = getCsrfToken();

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    // Sends/receives the httpOnly auth cookies. Required since the frontend and backend
    // are on different origins (see docs/architecture.md).
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { [CSRF_TOKEN_HEADER]: csrfToken } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : response.statusText;
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export const apiClient = {
  getHealth: () => request<HealthCheckResponse>("/health"),
  register: (payload: RegisterRequest) =>
    request<UserPublic>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  login: (payload: LoginRequest) =>
    request<UserPublic>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<void>("/api/v1/auth/logout", { method: "POST" }),
  me: () => request<UserPublic>("/api/v1/auth/me"),

  listVendors: () => request<Vendor[]>("/api/v1/vendors"),
  getVendor: (vendorId: string) => request<Vendor>(`/api/v1/vendors/${vendorId}`),
  createVendor: (payload: VendorCreate) =>
    request<Vendor>("/api/v1/vendors", { method: "POST", body: JSON.stringify(payload) }),
  updateVendor: (vendorId: string, payload: VendorUpdate) =>
    request<Vendor>(`/api/v1/vendors/${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteVendor: (vendorId: string) =>
    request<void>(`/api/v1/vendors/${vendorId}`, { method: "DELETE" }),

  listProposals: (vendorId: string) =>
    request<Proposal[]>(`/api/v1/vendors/${vendorId}/proposals`),
  listAllProposals: () => request<Proposal[]>("/api/v1/proposals"),
  getProposal: (proposalId: string) => request<Proposal>(`/api/v1/proposals/${proposalId}`),
  createProposal: (vendorId: string, payload: ProposalCreate) =>
    request<Proposal>(`/api/v1/vendors/${vendorId}/proposals`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateProposal: (proposalId: string, payload: ProposalUpdate) =>
    request<Proposal>(`/api/v1/proposals/${proposalId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  deleteProposal: (proposalId: string) =>
    request<void>(`/api/v1/proposals/${proposalId}`, { method: "DELETE" }),

  compareProposals: (payload: ComparisonRequest) =>
    request<ComparisonResponse>("/api/v1/proposals/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
