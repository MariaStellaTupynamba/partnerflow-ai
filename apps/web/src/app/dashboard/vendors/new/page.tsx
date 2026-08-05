"use client";

import { DashboardHeader } from "@/components/DashboardHeader";
import { VendorForm } from "@/components/VendorForm";
import { useCurrentUser } from "@/lib/user-context";

export default function NewVendorPage() {
  const user = useCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <DashboardHeader email={user.email} />
      <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Add vendor
        </h1>
        <VendorForm />
      </main>
    </div>
  );
}
