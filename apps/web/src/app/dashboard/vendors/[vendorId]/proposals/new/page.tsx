import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/DashboardHeader";
import { ProposalForm } from "@/components/ProposalForm";
import { getCurrentUser, getVendor } from "@/lib/server-api";

export default async function NewProposalPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { vendorId } = await params;
  const vendor = await getVendor(vendorId);
  if (!vendor) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{vendor.name}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Add proposal
        </h1>
        <ProposalForm vendorId={vendor.id} />
      </main>
    </div>
  );
}
