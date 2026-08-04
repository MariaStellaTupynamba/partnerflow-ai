import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/DashboardHeader";
import { ProposalComparison } from "@/components/ProposalComparison";
import { getAllProposals, getCurrentUser, getVendors } from "@/lib/server-api";

export default async function ComparePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [proposals, vendors] = await Promise.all([getAllProposals(), getVendors()]);
  const vendorNamesById = Object.fromEntries((vendors ?? []).map((v) => [v.id, v.name]));

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
        <ProposalComparison proposals={proposals ?? []} vendorNamesById={vendorNamesById} />
      </main>
    </div>
  );
}
