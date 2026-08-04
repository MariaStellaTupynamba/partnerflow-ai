import Link from "next/link";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/DashboardHeader";
import { getCurrentUser, getVendors } from "@/lib/server-api";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const vendors = (await getVendors()) ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Vendors
          </h1>
          <div className="flex gap-3">
            <Link
              href="/dashboard/compare"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Compare proposals
            </Link>
            <Link
              href="/dashboard/vendors/new"
              className="rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Add vendor
            </Link>
          </div>
        </div>

        {vendors.length === 0 ? (
          <p className="mt-8 text-sm text-zinc-500 dark:text-zinc-400">
            No vendors yet.{" "}
            <Link href="/dashboard/vendors/new" className="underline">
              Add your first vendor
            </Link>{" "}
            to start tracking proposals.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {vendors.map((vendor) => (
              <li key={vendor.id}>
                <Link
                  href={`/dashboard/vendors/${vendor.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium text-zinc-950 dark:text-zinc-50">
                    {vendor.name}
                  </span>
                  {vendor.contactEmail && (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {vendor.contactEmail}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
