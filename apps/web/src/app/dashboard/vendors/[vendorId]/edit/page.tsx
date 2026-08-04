import { notFound, redirect } from "next/navigation";

import { DashboardHeader } from "@/components/DashboardHeader";
import { VendorForm } from "@/components/VendorForm";
import { getCurrentUser, getVendor } from "@/lib/server-api";

export default async function EditVendorPage({
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Edit vendor
        </h1>
        <VendorForm vendor={vendor} />
      </main>
    </div>
  );
}
