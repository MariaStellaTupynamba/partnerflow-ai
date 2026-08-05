"use client";

import type { Proposal, Vendor } from "@partnerflow/shared-types";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/DashboardHeader";
import { ProposalComparison } from "@/components/ProposalComparison";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/user-context";

export default function ComparePage() {
  const user = useCurrentUser();
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiClient.listAllProposals(), apiClient.listVendors()]).then(
      ([proposalsResult, vendorsResult]) => {
        if (cancelled) return;
        setProposals(proposalsResult);
        setVendors(vendorsResult);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorNamesById = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Compare proposals
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Select two or more proposals — from any vendor — and get an AI-generated comparison of
          price, scope, and terms.
        </p>
        {proposals === null ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : (
          <ProposalComparison proposals={proposals} vendorNamesById={vendorNamesById} />
        )}
      </main>
    </div>
  );
}
