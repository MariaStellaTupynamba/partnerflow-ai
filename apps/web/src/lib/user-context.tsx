"use client";

import type { UserPublic } from "@partnerflow/shared-types";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";

const UserContext = createContext<UserPublic | null>(null);

/**
 * Must be used inside <DashboardAuthGate>. The gate never renders `children` until this is
 * non-null, so components using this hook can treat the return value as always-present.
 */
export function useCurrentUser(): UserPublic {
  const user = useContext(UserContext);
  if (!user) {
    throw new Error("useCurrentUser() called outside of DashboardAuthGate.");
  }
  return user;
}

/**
 * Client-side auth gate for everything under /dashboard.
 *
 * This can't be a server-side check (the previous approach): the auth cookies are set by the
 * backend's own domain (Render), which is different from this frontend's domain (Cloudflare
 * Workers) in production. A server-side render of this page never receives those cookies in
 * the first place — only a real browser request, made directly from client-side JS with
 * `credentials: "include"`, actually has them. See docs/architecture.md.
 */
export function DashboardAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserPublic | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .me()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      </div>
    );
  }

  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
