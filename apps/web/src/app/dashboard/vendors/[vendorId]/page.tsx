import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/DashboardHeader";
import { DeleteProposalButton } from "@/components/DeleteProposalButton";
import { DeleteVendorButton } from "@/components/DeleteVendorButton";
import { getCurrentUser, getProposalsForVendor, getVendor } from "@/lib/server-api";

function formatPrice(price: string | null, currency: string): string {
  if (price === null) return "Price not specified";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(price));
}

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { vendorId } = await params;
  const [vendor, proposals] = await Promise.all([
    getVendor(vendorId),
    getProposalsForVendor(vendorId),
  ]);
  if (!vendor) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
          ← Vendors
        </Link>

        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {vendor.name}
            </h1>
            {vendor.website && (
              <a
                href={vendor.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
              >
                {vendor.website}
              </a>
            )}
            {(vendor.contactName || vendor.contactEmail) && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {[vendor.contactName, vendor.contactEmail].filter(Boolean).join(" · ")}
              </p>
            )}
            {vendor.notes && (
              <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                {vendor.notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/vendors/${vendor.id}/edit`}
              className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
            >
              Edit
            </Link>
            <DeleteVendorButton vendorId={vendor.id} />
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Proposals</h2>
          <Link
            href={`/dashboard/vendors/${vendor.id}/proposals/new`}
            className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Add proposal
          </Link>
        </div>

        {!proposals || proposals.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            No proposals from this vendor yet.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {proposals.map((proposal) => (
              <li key={proposal.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">{proposal.title}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {formatPrice(proposal.price, proposal.currency)}
                    {proposal.submittedAt ? ` · Submitted ${proposal.submittedAt}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/dashboard/vendors/${vendor.id}/proposals/${proposal.id}/edit`}
                    className="text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    Edit
                  </Link>
                  <DeleteProposalButton proposalId={proposal.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
