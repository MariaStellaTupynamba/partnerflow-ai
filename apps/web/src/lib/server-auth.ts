import type { UserPublic } from "@partnerflow/shared-types";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * Reads the current user server-side, for use in Server Components (e.g. protecting
 * /dashboard). Unlike the browser's `apiClient`, a server-side fetch has no cookie jar of
 * its own — the incoming request's cookies have to be forwarded explicitly.
 *
 * Returns null on any failure (no session, expired token, backend unreachable) rather than
 * throwing, since the only thing callers need to know is "authenticated or not."
 */
export async function getCurrentUser(): Promise<UserPublic | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${env.apiUrl}/api/v1/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as UserPublic;
  } catch {
    return null;
  }
}
