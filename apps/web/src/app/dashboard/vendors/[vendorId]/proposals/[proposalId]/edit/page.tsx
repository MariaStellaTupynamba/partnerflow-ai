"use client";

import type { Proposal, Vendor } from "@partnerflow/shared-types";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/DashboardHeader";
import { ProposalForm } from "@/components/ProposalForm";
import { ApiError, apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/user-context";

export default function EditProposalPage() {
  const user = useCurrentUser();
  const { vendorId, proposalId } = useParams<{ vendorId: string; proposalId: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [notFoundError, setNotFoundError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([apiClient.getVendor(vendorId), apiClient.getProposal(proposalId)])
      .then(([vendorResult, proposalResult]) => {
        if (cancelled) return;
        if (proposalResult.vendorId !== vendorResult.id) {
          setNotFoundError(true);
          return;
        }
        setVendor(vendorResult);
        setProposal(proposalResult);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 404) {
          setNotFoundError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vendorId, proposalId]);

  if (notFoundError) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        {vendor && proposal ? (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{vendor.name}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Edit proposal
            </h1>
            <ProposalForm vendorId={vendor.id} proposal={proposal} />
          </>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        )}
      </main>
    </div>
  );
}
