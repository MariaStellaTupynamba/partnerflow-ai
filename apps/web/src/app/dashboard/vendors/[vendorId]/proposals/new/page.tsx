"use client";

import type { Vendor } from "@partnerflow/shared-types";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/DashboardHeader";
import { ProposalForm } from "@/components/ProposalForm";
import { ApiError, apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/user-context";

export default function NewProposalPage() {
  const user = useCurrentUser();
  const { vendorId } = useParams<{ vendorId: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [notFoundError, setNotFoundError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getVendor(vendorId)
      .then((result) => {
        if (!cancelled) setVendor(result);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 404) {
          setNotFoundError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  if (notFoundError) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        {vendor ? (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{vendor.name}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Add proposal
            </h1>
            <ProposalForm vendorId={vendor.id} />
          </>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        )}
      </main>
    </div>
  );
}
