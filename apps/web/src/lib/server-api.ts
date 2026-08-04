import type { Proposal, UserPublic, Vendor } from "@partnerflow/shared-types";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * A server-side fetch against the API, for use in Server Components. Unlike the browser's
 * `apiClient`, a server-side fetch has no cookie jar of its own — the incoming request's
 * cookies have to be forwarded explicitly.
 *
 * Returns null on any failure (no session, expired token, not found, backend unreachable)
 * rather than throwing — callers redirect on null rather than rendering an error boundary,
 * since an expired/missing session is an expected, common case here, not an exceptional one.
 */
async function serverFetch<T>(path: string): Promise<T | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${env.internalApiUrl}${path}`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getCurrentUser(): Promise<UserPublic | null> {
  return serverFetch<UserPublic>("/api/v1/auth/me");
}

export function getVendors(): Promise<Vendor[] | null> {
  return serverFetch<Vendor[]>("/api/v1/vendors");
}

export function getVendor(vendorId: string): Promise<Vendor | null> {
  return serverFetch<Vendor>(`/api/v1/vendors/${vendorId}`);
}

export function getProposalsForVendor(vendorId: string): Promise<Proposal[] | null> {
  return serverFetch<Proposal[]>(`/api/v1/vendors/${vendorId}/proposals`);
}

export function getProposal(proposalId: string): Promise<Proposal | null> {
  return serverFetch<Proposal>(`/api/v1/proposals/${proposalId}`);
}

export function getAllProposals(): Promise<Proposal[] | null> {
  return serverFetch<Proposal[]>("/api/v1/proposals");
}
